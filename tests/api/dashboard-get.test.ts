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
      usage: {
        max_cvs: { limit: 30, used: 3, remaining: 27 },
        max_application_letters: { limit: 60, used: 4, remaining: 56 },
        max_applications: { limit: 500, used: 12, remaining: 488 },
        max_document_storage_bytes: { limit: 209715200, used: 1024, remaining: 209714176 },
        max_cv_pdf_downloads: { limit: 30, used: 14, remaining: 16 },
        max_cv_docx_downloads: { limit: 10, used: 2, remaining: 8 },
        max_letter_pdf_downloads: { limit: 30, used: 5, remaining: 25 },
        max_letter_docx_downloads: { limit: 10, used: 1, remaining: 9 },
        max_cv_ai_improvements: { limit: 50, used: 3, remaining: 47 },
        max_application_letter_ai_improvements: { limit: 100, used: 5, remaining: 95 },
        can_use_premium_cv_templates: true,
        can_use_premium_application_letter_templates: true,
      },
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
      usage: {
        max_cv_pdf_downloads: { limit: 30, used: 14, remaining: 16 },
      },
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
      usage: {
        max_cvs: { limit: 10, used: 0, remaining: 10 },
        max_application_letters: { limit: 20, used: 0, remaining: 20 },
        max_applications: { limit: 100, used: 0, remaining: 100 },
        max_document_storage_bytes: { limit: 52428800, used: 0, remaining: 52428800 },
        max_cv_pdf_downloads: { limit: 10, used: 0, remaining: 10 },
        max_cv_docx_downloads: { limit: 3, used: 0, remaining: 3 },
        max_letter_pdf_downloads: { limit: 10, used: 0, remaining: 10 },
        max_letter_docx_downloads: { limit: 3, used: 0, remaining: 3 },
        max_cv_ai_improvements: { limit: 10, used: 0, remaining: 10 },
        max_application_letter_ai_improvements: { limit: 20, used: 0, remaining: 20 },
        can_use_premium_cv_templates: false,
        can_use_premium_application_letter_templates: false,
      },
    } as never);

    const response = await request(app)
      .get("/dashboard")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(200);
    expect(response.body.data.total_applications).toBe(0);
    expect(response.body.data.total_cvs).toBe(0);
    expect(response.body.data.usage.max_cv_pdf_downloads.used).toBe(0);
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
    });
    expect(response.body.data).toHaveProperty("usage");
    expect(typeof response.body.data.usage.max_cv_pdf_downloads.used).toBe("number");
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
