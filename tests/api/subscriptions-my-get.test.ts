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
      midtransOrderId: "SUB-user-1-123",
      midtransToken: null,
      snapUrl: null,
      canResumePayment: false,
      midtransPaymentType: "gopay",
      currentLimits: {
        maxCvs: 15,
        maxApplications: 500,
        maxApplicationLetters: 15,
        maxDocumentStorageBytes: 104857600,
        downloads: {
          cvPerDay: 15,
          applicationLetterPerDay: 15,
          cvDocxPerDay: 15,
          applicationLetterDocxPerDay: 15,
          cvPdfPerDay: 15,
          applicationLetterPdfPerDay: 15,
        },
      },
      currentFeatures: {
        canManageDocuments: true,
        canUsePremiumCvTemplates: true,
        canUsePremiumApplicationLetterTemplates: true,
        canUsePremiumTemplates: true,
        canDuplicateCvs: true,
        canDuplicateApplications: true,
        canDuplicateApplicationLetters: true,
        canDownloadCvDocx: true,
        canDownloadApplicationLetterDocx: true,
        canDownloadCvPdf: true,
        canDownloadApplicationLetterPdf: true,
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
      midtransOrderId: "SUB-PRO-ABC123",
      midtransToken: "snap-token-pending",
      snapUrl: null,
      canResumePayment: true,
      midtransPaymentType: null,
      currentLimits: {
        maxCvs: 2,
        maxApplications: 50,
        maxApplicationLetters: 2,
        maxDocumentStorageBytes: 10485760,
        downloads: {
          cvPerDay: 2,
          applicationLetterPerDay: 2,
          cvDocxPerDay: 0,
          applicationLetterDocxPerDay: 0,
          cvPdfPerDay: 2,
          applicationLetterPdfPerDay: 2,
        },
      },
      currentFeatures: {
        canManageDocuments: false,
        canUsePremiumCvTemplates: false,
        canUsePremiumApplicationLetterTemplates: false,
        canUsePremiumTemplates: false,
        canDuplicateCvs: false,
        canDuplicateApplications: false,
        canDuplicateApplicationLetters: false,
        canDownloadCvDocx: false,
        canDownloadApplicationLetterDocx: false,
        canDownloadCvPdf: true,
        canDownloadApplicationLetterPdf: true,
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
        midtransOrderId: `SUB-${user.id}-${Date.now()}`,
        midtransToken: "snap-token",
        midtransPaymentType: "gopay",
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
        max_cvs: 15,
        max_applications: 500,
        max_application_letters: 15,
        max_document_storage_bytes: 104857600,
        downloads: {
          cv_per_day: 15,
          application_letter_per_day: 15,
          cv_docx_per_day: 15,
          application_letter_docx_per_day: 15,
          cv_pdf_per_day: 15,
          application_letter_pdf_per_day: 15,
        },
      },
      current_features: {
        can_manage_documents: true,
        can_use_premium_cv_templates: true,
        can_use_premium_application_letter_templates: true,
        can_use_premium_templates: true,
        can_duplicate_cvs: true,
        can_duplicate_applications: true,
        can_duplicate_application_letters: true,
        can_download_cv_docx: true,
        can_download_application_letter_docx: true,
        can_download_cv_pdf: true,
        can_download_application_letter_pdf: true,
      },
    });
  });

  it("returns 401 for unauthenticated subscription lookup", async () => {
    const response = await request(app).get("/subscriptions/my");

    expect(response.status).toBe(401);
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });
});
