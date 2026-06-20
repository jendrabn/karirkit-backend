import request from "supertest";
import {
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
  loadPrisma,
} from "./real-mode";

let app: typeof import("../../src/index").default;
let SubscriptionService: typeof import("../../src/services/subscription.service").SubscriptionService;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/config/prisma.config", () => ({
      prisma: {},
    }));
    jest.doMock("../../src/services/download-log.service", () => ({
      DownloadLogService: {},
    }));
    jest.doMock("../../src/services/application.service", () => ({
      ApplicationService: {},
    }));
    jest.doMock("../../src/services/application-letter.service", () => ({
      ApplicationLetterService: {},
    }));
    jest.doMock("../../src/services/template.service", () => ({
      TemplateService: {},
    }));
    jest.doMock("../../src/services/job.service", () => ({
      JobService: {},
    }));
    jest.doMock("../../src/services/subscription.service", () => ({
      SubscriptionService: {
        getCurrentSubscription: jest.fn(),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ SubscriptionService } = await import(
    "../../src/services/subscription.service"
  ));
});

afterAll(async () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    await disconnectPrisma();
  }
});

describe("GET /subscriptions/my", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the authenticated user subscription", async () => {
    const getCurrentMock = jest.mocked(
      SubscriptionService.getCurrentSubscription
    );
    getCurrentMock.mockResolvedValue({
      id: "sub-1",
      plan: "pro",
      pendingPlan: null,
      status: "paid",
      amount: 25000,
      paidAt: "2026-03-01T00:00:00.000Z",
      expiresAt: "2026-04-01T00:00:00.000Z",
      gateway: "midtrans",
      orderId: "SUB-user-1-123",
      providerToken: null,
      snapUrl: null,
      canResumePayment: false,
      paymentType: "gopay",
      currentLimits: {
        maxCvs: 30,
        maxApplications: 500,
        maxApplicationLetters: 60,
        maxDocumentStorageBytes: 209715200,
        maxCvPdfDownloads: 30,
        maxCvDocxDownloads: 10,
        maxLetterPdfDownloads: 30,
        maxLetterDocxDownloads: 10,
        maxCvAiImprovements: 50,
        maxApplicationLetterAiImprovements: 100,
      },
      currentFeatures: {
        canUsePremiumCvTemplates: true,
        canUsePremiumApplicationLetterTemplates: true,
      },
    } as never);

    const response = await request(app)
      .get("/subscriptions/my")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: "sub-1",
      plan: "pro",
      status: "paid",
      paid_at: "2026-03-01T00:00:00.000Z",
      expires_at: "2026-04-01T00:00:00.000Z",
      gateway: "midtrans",
      order_id: "SUB-user-1-123",
      midtrans_order_id: "SUB-user-1-123",
      snap_token: null,
      snap_url: null,
      can_resume_payment: false,
      midtrans_payment_type: "gopay",
    });
  });

  it("returns pending payment resume data when subscription is pending", async () => {
    const getCurrentMock = jest.mocked(
      SubscriptionService.getCurrentSubscription
    );
    getCurrentMock.mockResolvedValue({
      id: "sub-2",
      plan: "free",
      pendingPlan: "pro",
      status: "pending",
      amount: 25000,
      paidAt: null,
      expiresAt: null,
      gateway: "midtrans",
      orderId: "SUB-PRO-ABC123",
      providerToken: "snap-token-pending",
      snapUrl: null,
      canResumePayment: true,
      paymentType: null,
      currentLimits: {
        maxCvs: 10,
        maxApplications: 100,
        maxApplicationLetters: 20,
        maxDocumentStorageBytes: 52428800,
        maxCvPdfDownloads: 10,
        maxCvDocxDownloads: 3,
        maxLetterPdfDownloads: 10,
        maxLetterDocxDownloads: 3,
        maxCvAiImprovements: 10,
        maxApplicationLetterAiImprovements: 20,
      },
      currentFeatures: {
        canUsePremiumCvTemplates: false,
        canUsePremiumApplicationLetterTemplates: false,
      },
    } as never);

    const response = await request(app)
      .get("/subscriptions/my")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      plan: "free",
      pending_plan: "pro",
      status: "pending",
      gateway: "midtrans",
      order_id: "SUB-PRO-ABC123",
      midtrans_order_id: "SUB-PRO-ABC123",
      snap_token: "snap-token-pending",
      snap_url: null,
      can_resume_payment: true,
    });
  });

  it("returns 401 for unauthenticated subscription lookup", async () => {
    const response = await request(app).get("/subscriptions/my");

    expect(response.status).toBe(401);
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });
});

describe("GET /subscriptions/my", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }

  const trackedEmails = new Set<string>();

  afterEach(async () => {
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("returns the active subscription and derived limits from the database", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("subscriptions-my-pro", {
      planId: "pro",
    });
    trackedEmails.add(user.email);

    const paidAt = new Date("2026-03-01T00:00:00.000Z");
    const expiresAt = new Date("2030-01-01T00:00:00.000Z");
    await prisma.subscription.create({
      data: {
        userId: user.id,
        plan: "pro",
        status: "paid",
        gateway: "midtrans",
        orderId: `SUB-${user.id}-${Date.now()}`,
        providerToken: "snap-token",
        paymentType: "gopay",
        amount: 25000,
        paidAt,
        expiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const token = await createSessionToken(user);
    const response = await request(app)
      .get("/subscriptions/my")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      plan: "pro",
      pending_plan: null,
      status: "paid",
      amount: 25000,
      snap_token: null,
      snap_url: null,
      can_resume_payment: false,
      midtrans_payment_type: "gopay",
      current_limits: {
        max_cvs: 30,
        max_applications: 500,
        max_application_letters: 60,
        max_document_storage_bytes: 209715200,
        max_cv_pdf_downloads: 30,
        max_cv_docx_downloads: 10,
        max_letter_pdf_downloads: 30,
        max_letter_docx_downloads: 10,
        max_cv_ai_improvements: 50,
        max_application_letter_ai_improvements: 100,
      },
      current_features: {
        can_use_premium_cv_templates: true,
        can_use_premium_application_letter_templates: true,
      },
    });
  });

  it("returns 401 for unauthenticated subscription lookup", async () => {
    const response = await request(app).get("/subscriptions/my");

    expect(response.status).toBe(401);
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });
});
