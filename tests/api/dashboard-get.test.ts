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
      active_applications: 8,
      inactive_applications: 4,
      interview_applications: 3,
      offer_applications: 1,
      accepted_applications: 1,
      rejected_applications: 3,
      needs_followup_applications: 5,
      overdue_applications: 2,
      no_followup_applications: 3,
      total_application_letters: 4,
      total_cvs: 3,
      total_portfolios: 2,
      total_documents: 6,
      saved_jobs_count: 7,
      subscription_plan: "pro",
      subscription_expires_at: "2026-12-31T00:00:00.000Z",
      download_today_count: 2,
      download_total_count: 14,
      document_storage_limit: 1073741824,
      document_storage_used: 1024,
      document_storage_remaining: 1073740800,
    } as never);

    const response = await request(app)
      .get("/dashboard")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      total_applications: 12,
      total_cvs: 3,
      subscription_plan: "pro",
      download_total_count: 14,
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
      active_applications: 0,
      inactive_applications: 0,
      interview_applications: 0,
      offer_applications: 0,
      accepted_applications: 0,
      rejected_applications: 0,
      needs_followup_applications: 0,
      overdue_applications: 0,
      no_followup_applications: 0,
      total_application_letters: 0,
      total_cvs: 0,
      total_portfolios: 0,
      total_documents: 0,
      saved_jobs_count: 0,
      subscription_plan: "free",
      subscription_expires_at: null,
      download_today_count: 0,
      download_total_count: 0,
      document_storage_limit: 1073741824,
      document_storage_used: 0,
      document_storage_remaining: 1073741824,
    } as never);

    const response = await request(app)
      .get("/dashboard")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(200);
    expect(response.body.data.total_applications).toBe(0);
    expect(response.body.data.total_cvs).toBe(0);
    expect(response.body.data.download_total_count).toBe(0);
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
      interview_applications: 0,
      offer_applications: 0,
      accepted_applications: 0,
      rejected_applications: 1,
      needs_followup_applications: 0,
      overdue_applications: 0,
      no_followup_applications: 1,
      total_application_letters: 0,
      total_cvs: 0,
      total_portfolios: 0,
      total_documents: 0,
      saved_jobs_count: 0,
      subscription_plan: "free",
      download_today_count: 0,
      download_total_count: 0,
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
    expect(response.body.data.subscription_plan).toBe("free");
    expect(response.body.data.total_documents).toBe(0);
  });
});
