import request from "supertest";
import {
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
  loadPrisma,
} from "./real-mode";

let app: typeof import("../../src/index").default;
let DashboardService: typeof import("../../src/services/dashboard.service").DashboardService;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/dashboard.service", () => ({
      DashboardService: {
        getUserStats: jest.fn(),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ DashboardService } = await import("../../src/services/dashboard.service"));
});

afterAll(async () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    await disconnectPrisma();
  }
});

describe("GET /dashboard", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns authenticated dashboard statistics", async () => {
    const getUserStatsMock = jest.mocked(DashboardService.getUserStats);
    getUserStatsMock.mockResolvedValue({
      total_applications: 12,
      total_cvs: 3,
    } as never);

    const response = await request(app)
      .get("/dashboard")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      total_applications: 12,
      total_cvs: 3,
    });
    expect(typeof response.body.data.total_applications).toBe("number");
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).get("/dashboard");

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("supports empty dashboard data for new users", async () => {
    const getUserStatsMock = jest.mocked(DashboardService.getUserStats);
    getUserStatsMock.mockResolvedValue({
      total_applications: 0,
      total_cvs: 0,
    } as never);

    const response = await request(app)
      .get("/dashboard")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(200);
    expect(response.body.data.total_applications).toBe(0);
    expect(response.body.data.total_cvs).toBe(0);
  });
});

describe("GET /dashboard", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();
  const trackedApplicationIds = new Set<string>();

  afterEach(async () => {
    const prisma = await loadPrisma();
    if (trackedApplicationIds.size > 0) {
      await prisma.application.deleteMany({
        where: { id: { in: [...trackedApplicationIds] } },
      });
    }
    trackedApplicationIds.clear();
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("returns authenticated dashboard statistics", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("dashboard-user");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const activeApplication = await prisma.application.create({
      data: {
        userId: user.id,
        companyName: "PT Aktif",
        position: "Engineer",
        jobType: "full_time",
        workSystem: "remote",
        date: new Date("2026-03-24T00:00:00.000Z"),
        status: "submitted",
        resultStatus: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const inactiveApplication = await prisma.application.create({
      data: {
        userId: user.id,
        companyName: "PT Tidak Aktif",
        position: "Engineer",
        jobType: "full_time",
        workSystem: "onsite",
        date: new Date("2026-03-24T00:00:00.000Z"),
        status: "rejected",
        resultStatus: "failed",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedApplicationIds.add(activeApplication.id);
    trackedApplicationIds.add(inactiveApplication.id);

    const response = await request(app)
      .get("/dashboard")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      total_applications: 2,
      active_applications: 1,
      inactive_applications: 1,
      total_application_letters: 0,
      total_cvs: 0,
      total_portfolios: 0,
    });
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).get("/dashboard");

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("supports empty dashboard data for new users", async () => {
    const { user } = await createRealUser("dashboard-empty");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .get("/dashboard")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.total_applications).toBe(0);
    expect(response.body.data.total_cvs).toBe(0);
  });
});
