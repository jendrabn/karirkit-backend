import request from "supertest";
import { disconnectPrisma } from "./real-mode";

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
        getPlans: jest.fn(),
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

describe("GET /subscriptions/plans", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns public subscription plans", async () => {
    const getPlansMock = jest.mocked(SubscriptionService.getPlans);
    getPlansMock.mockReturnValue([
      {
        id: "free",
        name: "Free",
        price: 0,
        durationDays: 0,
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
        canUsePremiumCvTemplates: false,
        canUsePremiumApplicationLetterTemplates: false,
      },
      {
        id: "pro",
        name: "Pro",
        price: 25000,
        durationDays: 30,
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
        canUsePremiumCvTemplates: true,
        canUsePremiumApplicationLetterTemplates: true,
      },
    ] as never);

    const response = await request(app).get("/subscriptions/plans");

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      payment_gateway_enabled: expect.any(Boolean),
      plans: [
        expect.objectContaining({
        id: "free",
        max_cv_pdf_downloads: 10,
        max_cv_docx_downloads: 3,
        max_letter_pdf_downloads: 10,
        max_letter_docx_downloads: 3,
        max_cv_ai_improvements: 10,
        max_application_letter_ai_improvements: 20,
        can_use_premium_cv_templates: false,
        can_use_premium_application_letter_templates: false,
        }),
        expect.objectContaining({
        id: "pro",
        max_cv_pdf_downloads: 30,
        max_cv_docx_downloads: 10,
        max_letter_pdf_downloads: 30,
        max_letter_docx_downloads: 10,
        max_cv_ai_improvements: 50,
        max_application_letter_ai_improvements: 100,
        can_use_premium_cv_templates: true,
        can_use_premium_application_letter_templates: true,
        }),
      ],
    });
  });
});

describe("GET /subscriptions/plans", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }

  it("returns public subscription plans with flat plan properties", async () => {
    const response = await request(app).get("/subscriptions/plans");

    expect(response.status).toBe(200);
    expect(response.body.data.payment_gateway_enabled).toEqual(
      expect.any(Boolean)
    );
    expect(Array.isArray(response.body.data.plans)).toBe(true);

    const freePlan = response.body.data.plans.find(
      (item: { id: string }) => item.id === "free"
    );

    expect(freePlan).toMatchObject({
      id: "free",
      name: "Free",
      max_cvs: 10,
      max_applications: 100,
      max_application_letters: 20,
      max_document_storage_bytes: expect.any(Number),
      max_cv_pdf_downloads: expect.any(Number),
      max_cv_docx_downloads: expect.any(Number),
      max_letter_pdf_downloads: expect.any(Number),
      max_letter_docx_downloads: expect.any(Number),
      max_cv_ai_improvements: expect.any(Number),
      max_application_letter_ai_improvements: expect.any(Number),
      can_use_premium_cv_templates: false,
      can_use_premium_application_letter_templates: false,
    });
    expect(freePlan).not.toHaveProperty("limits");
    expect(freePlan).not.toHaveProperty("features");
  });
});
