import request from "supertest";
import { disconnectPrisma } from "./real-mode";

let app: typeof import("../../src/index").default;
let SubscriptionService: typeof import("../../src/services/subscription.service").SubscriptionService;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/application.service", () => ({
      ApplicationService: {},
    }));
    jest.doMock("../../src/services/application-letter.service", () => ({
      ApplicationLetterService: {},
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
        cvPdfDownloadsPerDay: 5,
        applicationLetterPdfDownloadsPerDay: 5,
        canManageDocuments: false,
        canUsePremiumCvTemplates: false,
        canUsePremiumApplicationLetterTemplates: false,
        canUsePremiumTemplates: false,
        canDuplicateCvs: true,
        canDuplicateApplications: true,
        canDuplicateApplicationLetters: true,
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
        cvPdfDownloadsPerDay: 15,
        applicationLetterPdfDownloadsPerDay: 15,
        canManageDocuments: true,
        canUsePremiumCvTemplates: true,
        canUsePremiumApplicationLetterTemplates: true,
        canUsePremiumTemplates: true,
        canDuplicateCvs: true,
        canDuplicateApplications: true,
        canDuplicateApplicationLetters: true,
        canDownloadCvPdf: true,
        canDownloadApplicationLetterPdf: true,
      },
    ] as never);

    const response = await request(app).get("/subscriptions/plans");

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([
      expect.objectContaining({
        id: "free",
        cvDownloadsPerDay: 5,
        applicationLetterDownloadsPerDay: 5,
        cvPdfDownloadsPerDay: 5,
        applicationLetterPdfDownloadsPerDay: 5,
        canDuplicateCvs: true,
        canDuplicateApplications: true,
        canDuplicateApplicationLetters: true,
        canManageDocuments: false,
      }),
      expect.objectContaining({
        id: "pro",
        cvDownloadsPerDay: 15,
        applicationLetterDownloadsPerDay: 15,
        cvPdfDownloadsPerDay: 15,
        applicationLetterPdfDownloadsPerDay: 15,
        canDuplicateCvs: true,
        canDuplicateApplications: true,
        canDuplicateApplicationLetters: true,
        canManageDocuments: true,
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
      maxCvs: 5,
      maxApplications: 100,
      maxApplicationLetters: 5,
      maxDocumentStorageBytes: 0,
      cvDownloadsPerDay: 5,
      applicationLetterDownloadsPerDay: 5,
      cvPdfDownloadsPerDay: 5,
      applicationLetterPdfDownloadsPerDay: 5,
      canManageDocuments: false,
      canUsePremiumCvTemplates: false,
      canUsePremiumApplicationLetterTemplates: false,
      canUsePremiumTemplates: false,
      canDuplicateCvs: true,
      canDuplicateApplications: true,
      canDuplicateApplicationLetters: true,
      canDownloadCvPdf: true,
      canDownloadApplicationLetterPdf: true,
    });
    expect(freePlan).not.toHaveProperty("limits");
    expect(freePlan).not.toHaveProperty("features");
  });
});
