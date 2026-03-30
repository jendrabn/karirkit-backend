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
        maxCvs: 5,
        maxApplications: 100,
        maxApplicationLetters: 5,
        maxDocumentStorageBytes: 0,
        cvDownloadsPerDay: 5,
        applicationLetterDownloadsPerDay: 5,
        cvDocxDownloadsPerDay: 5,
        applicationLetterDocxDownloadsPerDay: 5,
        cvPdfDownloadsPerDay: 5,
        applicationLetterPdfDownloadsPerDay: 5,
        canManageDocuments: false,
        canUsePremiumCvTemplates: false,
        canUsePremiumApplicationLetterTemplates: false,
        canUsePremiumTemplates: false,
        canDuplicateCvs: true,
        canDuplicateApplications: true,
        canDuplicateApplicationLetters: true,
        canDownloadCvDocx: true,
        canDownloadApplicationLetterDocx: true,
        canDownloadCvPdf: true,
        canDownloadApplicationLetterPdf: true,
      },
      {
        id: "pro",
        name: "Pro",
        price: 25000,
        maxCvs: 15,
        maxApplications: 500,
        maxApplicationLetters: 15,
        maxDocumentStorageBytes: 104857600,
        cvDownloadsPerDay: 15,
        applicationLetterDownloadsPerDay: 15,
        cvDocxDownloadsPerDay: 15,
        applicationLetterDocxDownloadsPerDay: 15,
        cvPdfDownloadsPerDay: 15,
        applicationLetterPdfDownloadsPerDay: 15,
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
    ] as never);

    const response = await request(app).get("/subscriptions/plans");

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([
      expect.objectContaining({
        id: "free",
        cv_downloads_per_day: 5,
        application_letter_downloads_per_day: 5,
        cv_docx_downloads_per_day: 5,
        application_letter_docx_downloads_per_day: 5,
        cv_pdf_downloads_per_day: 5,
        application_letter_pdf_downloads_per_day: 5,
        can_duplicate_cvs: true,
        can_duplicate_applications: true,
        can_duplicate_application_letters: true,
        can_download_cv_docx: true,
        can_download_application_letter_docx: true,
        can_manage_documents: false,
      }),
      expect.objectContaining({
        id: "pro",
        cv_downloads_per_day: 15,
        application_letter_downloads_per_day: 15,
        cv_docx_downloads_per_day: 15,
        application_letter_docx_downloads_per_day: 15,
        cv_pdf_downloads_per_day: 15,
        application_letter_pdf_downloads_per_day: 15,
        can_duplicate_cvs: true,
        can_duplicate_applications: true,
        can_duplicate_application_letters: true,
        can_download_cv_docx: true,
        can_download_application_letter_docx: true,
        can_manage_documents: true,
      }),
    ]);
  });
});

describe("GET /subscriptions/plans", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }

  it("returns public subscription plans with flat plan properties", async () => {
    const response = await request(app).get("/subscriptions/plans");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);

    const freePlan = response.body.data.find(
      (item: { id: string }) => item.id === "free"
    );

    expect(freePlan).toMatchObject({
      id: "free",
      name: "Free",
      max_cvs: 5,
      max_applications: 100,
      max_application_letters: 5,
      max_document_storage_bytes: 0,
      cv_downloads_per_day: 5,
      application_letter_downloads_per_day: 5,
      cv_docx_downloads_per_day: 5,
      application_letter_docx_downloads_per_day: 5,
      cv_pdf_downloads_per_day: 5,
      application_letter_pdf_downloads_per_day: 5,
      can_manage_documents: false,
      can_use_premium_cv_templates: false,
      can_use_premium_application_letter_templates: false,
      can_use_premium_templates: false,
      can_duplicate_cvs: true,
      can_duplicate_applications: true,
      can_duplicate_application_letters: true,
      can_download_cv_docx: true,
      can_download_application_letter_docx: true,
      can_download_cv_pdf: true,
      can_download_application_letter_pdf: true,
    });
    expect(freePlan).not.toHaveProperty("limits");
    expect(freePlan).not.toHaveProperty("features");
  });
});
