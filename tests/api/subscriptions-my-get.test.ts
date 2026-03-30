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
      status: "paid",
      amount: 25000,
      paidAt: "2026-03-01T00:00:00.000Z",
      expiresAt: "2026-04-01T00:00:00.000Z",
      midtransOrderId: "SUB-user-1-123",
      midtransPaymentType: "gopay",
      currentLimits: {
        maxCvs: 15,
        maxApplications: 500,
        maxApplicationLetters: 15,
        maxDocumentStorageBytes: 104857600,
        downloads: {
          cvPerDay: 15,
          applicationLetterPerDay: 15,
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
      status: "paid",
      amount: 25000,
      midtransPaymentType: "gopay",
      currentLimits: {
        maxCvs: 15,
        maxApplications: 500,
        maxApplicationLetters: 15,
        maxDocumentStorageBytes: 104857600,
        downloads: {
          cvPerDay: 15,
          applicationLetterPerDay: 15,
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
        canDownloadCvPdf: true,
        canDownloadApplicationLetterPdf: true,
      },
    });
  });

  it("returns 401 for unauthenticated subscription lookup", async () => {
    const response = await request(app).get("/subscriptions/my");

    expect(response.status).toBe(401);
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });
});
