import request from "supertest";
import {
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
  loadPrisma,
} from "./real-mode";

const validId = "550e8400-e29b-41d4-a716-446655440000";
let app: typeof import("../../src/index").default;
let ApplicationService: typeof import("../../src/services/application.service").ApplicationService;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/application.service", () => ({
      ApplicationService: {
        list: jest.fn(),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ ApplicationService } = await import("../../src/services/application.service"));
});

afterAll(async () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    await disconnectPrisma();
  }
});

describe("GET /applications", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a paginated application list", async () => {
    const listMock = jest.mocked(ApplicationService.list);
    listMock.mockResolvedValue({
      items: [{ id: validId, name: "Application 1" }],
      meta: { page: 1, per_page: 20, total: 1 },
    } as never);

    const response = await request(app)
      .get("/applications").set("Authorization", "Bearer user-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body).toHaveProperty("data.meta");
    expect(Array.isArray(response.body.data.items)).toBe(true);
    expect(response.body.data.items[0]).toMatchObject({ id: validId, name: "Application 1" });
    expect(typeof response.body.data.meta.total).toBe("number");
  });

  it("returns 401 when the request is unauthenticated", async () => {
    
    const response = await request(app)
      .get("/applications");

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("supports an empty application state", async () => {
    const listMock = jest.mocked(ApplicationService.list);
    listMock.mockResolvedValue({ items: [], meta: { page: 1, per_page: 20, total: 0 } } as never);

    const response = await request(app)
      .get("/applications").set("Authorization", "Bearer user-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body.data.items).toEqual([]);
    expect(response.body.data.meta.total).toBe(0);
  });
});

describe("GET /applications", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();

  afterEach(async () => {
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("returns a paginated application list from the database", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("applications-list");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    await prisma.application.createMany({
      data: [
        {
          userId: user.id,
          companyName: "PT Satu",
          position: "Backend Engineer",
          jobType: "full_time",
          workSystem: "remote",
          date: new Date("2026-03-21T00:00:00.000Z"),
          status: "submitted",
          resultStatus: "pending",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          userId: user.id,
          companyName: "PT Dua",
          position: "Frontend Engineer",
          jobType: "contract",
          workSystem: "hybrid",
          date: new Date("2026-03-22T00:00:00.000Z"),
          status: "hr_interview",
          resultStatus: "passed",
          followUpDate: new Date("2026-03-25T00:00:00.000Z"),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });

    const response = await request(app)
      .get("/applications?sort_by=date&sort_order=asc")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body).toHaveProperty("data.pagination");
    expect(Array.isArray(response.body.data.items)).toBe(true);
    expect(response.body.data.items).toHaveLength(2);
    expect(response.body.data.items[0]).toMatchObject({
      company_name: "PT Satu",
      position: "Backend Engineer",
    });
    expect(response.body.data.pagination.total_items).toBe(2);
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).get("/applications");

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("supports an empty application state", async () => {
    const { user } = await createRealUser("applications-list-empty");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .get("/applications?status=rejected")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body.data.items).toEqual([]);
    expect(response.body.data.pagination.total_items).toBe(0);
  });
});
