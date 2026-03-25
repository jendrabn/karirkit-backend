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
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/application.service", () => ({
      ApplicationService: {
        get: jest.fn(),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ ApplicationService } = await import("../../src/services/application.service"));
  ({ ResponseError: ResponseErrorClass } = await import(
    "../../src/utils/response-error.util"
  ));
});

afterAll(async () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    await disconnectPrisma();
  }
});

describe("GET /applications/:id", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns application details", async () => {
    const getMock = jest.mocked(ApplicationService.get);
    getMock.mockResolvedValue({ id: validId, name: "Application Detail" } as never);

    const response = await request(app)
      .get(`/applications/${validId}`).set("Authorization", "Bearer user-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({ id: validId, name: "Application Detail" });
    expect(typeof response.body.data.id).toBe("string");
  });

  it("returns 401 when authentication is missing", async () => {
    
    const response = await request(app)
      .get(`/applications/${validId}`);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated ".trim());
  });

  it("returns 404 when the application does not exist", async () => {
    const getMock = jest.mocked(ApplicationService.get);
    getMock.mockRejectedValue(
      new ResponseErrorClass(404, "Application tidak ditemukan"),
    );

    const response = await request(app)
      .get(`/applications/${validId}`).set("Authorization", "Bearer user-token");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Application tidak ditemukan");
  });
});

describe("GET /applications/:id", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();

  afterEach(async () => {
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("returns application details for the owner", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("applications-get");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const application = await prisma.application.create({
      data: {
        userId: user.id,
        companyName: "PT Detail",
        position: "Platform Engineer",
        jobType: "full_time",
        workSystem: "remote",
        date: new Date("2026-03-21T00:00:00.000Z"),
        status: "submitted",
        resultStatus: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const response = await request(app)
      .get(`/applications/${application.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: application.id,
      user_id: user.id,
      company_name: "PT Detail",
      position: "Platform Engineer",
      status: "submitted",
    });
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app).get(`/applications/${validId}`);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 404 when the application belongs to another user", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("applications-get-owner");
    const { user: otherUser } = await createRealUser("applications-get-other");
    trackedEmails.add(user.email);
    trackedEmails.add(otherUser.email);
    const token = await createSessionToken(user);

    const application = await prisma.application.create({
      data: {
        userId: otherUser.id,
        companyName: "PT Private",
        position: "Data Engineer",
        jobType: "full_time",
        workSystem: "onsite",
        date: new Date("2026-03-22T00:00:00.000Z"),
        status: "submitted",
        resultStatus: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const response = await request(app)
      .get(`/applications/${application.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Lamaran tidak ditemukan");
  });
});
