import request from "supertest";
import {
  createRealCvFixture,
  createRealTemplateFixture,
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
  loadPrisma,
} from "./real-mode";

const validId = "550e8400-e29b-41d4-a716-446655440000";

let app: typeof import("../../src/index").default;
let CvService: typeof import("../../src/services/cv.service").CvService;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/cv.service", () => ({
      CvService: {
        list: jest.fn(),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ CvService } = await import("../../src/services/cv.service"));
});

afterAll(async () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    await disconnectPrisma();
  }
});

describe("GET /cvs", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a paginated cv list", async () => {
    const listMock = jest.mocked(CvService.list);
    listMock.mockResolvedValue({
      items: [{ id: validId, name: "CV 1" }],
      meta: { page: 1, per_page: 20, total: 1 },
    } as never);

    const response = await request(app)
      .get("/cvs")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body).toHaveProperty("data.meta");
    expect(Array.isArray(response.body.data.items)).toBe(true);
    expect(response.body.data.items[0]).toMatchObject({ id: validId, name: "CV 1" });
    expect(typeof response.body.data.meta.total).toBe("number");
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).get("/cvs");

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("supports an empty cv state", async () => {
    const listMock = jest.mocked(CvService.list);
    listMock.mockResolvedValue({
      items: [],
      meta: { page: 1, per_page: 20, total: 0 },
    } as never);

    const response = await request(app)
      .get("/cvs")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body.data.items).toEqual([]);
    expect(response.body.data.meta.total).toBe(0);
  });
});

describe("GET /cvs", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();
  const trackedTemplateIds = new Set<string>();
  const trackedCvIds = new Set<string>();

  afterEach(async () => {
    const prisma = await loadPrisma();
    if (trackedCvIds.size > 0) {
      await prisma.cv.deleteMany({
        where: { id: { in: [...trackedCvIds] } },
      });
    }
    if (trackedTemplateIds.size > 0) {
      await prisma.template.deleteMany({
        where: { id: { in: [...trackedTemplateIds] } },
      });
    }
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
    trackedTemplateIds.clear();
    trackedCvIds.clear();
  });

  it("returns a paginated cv list", async () => {
    const { user } = await createRealUser("cv-list");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const template = await createRealTemplateFixture("cv", "cv-list");
    trackedTemplateIds.add(template.id);
    const cvOne = await createRealCvFixture(user.id, template.id, { name: "CV Alpha" });
    const cvTwo = await createRealCvFixture(user.id, template.id, { name: "CV Beta" });
    trackedCvIds.add(cvOne.id);
    trackedCvIds.add(cvTwo.id);

    const response = await request(app)
      .get("/cvs?q=CV&sort_by=name&sort_order=asc")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body).toHaveProperty("data.pagination");
    expect(response.body.data.items).toHaveLength(2);
    expect(response.body.data.pagination.total_items).toBe(2);
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).get("/cvs");

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("supports an empty cv state", async () => {
    const { user } = await createRealUser("cv-list-empty");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .get("/cvs")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.items).toEqual([]);
    expect(response.body.data.pagination.total_items).toBe(0);
  });
});
