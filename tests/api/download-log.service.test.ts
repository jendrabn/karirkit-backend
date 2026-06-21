let DownloadLogService: typeof import("../../src/services/download-log.service").DownloadLogService;
let prismaMock: typeof import("../../src/config/prisma.config").prisma;
let SUBSCRIPTION_PLANS: typeof import("../../src/config/subscription-plans.config").SUBSCRIPTION_PLANS;

beforeAll(async () => {
  jest.resetModules();
  jest.doMock("../../src/config/prisma.config", () => ({
    prisma: {
      user: { findUnique: jest.fn() },
      subscription: { findFirst: jest.fn() },
      usageLog: { count: jest.fn(), create: jest.fn(), groupBy: jest.fn() },
    },
  }));

  ({ DownloadLogService } = await import("../../src/services/download-log.service"));
  ({ prisma: prismaMock } = await import("../../src/config/prisma.config"));
  ({ SUBSCRIPTION_PLANS } = await import("../../src/config/subscription-plans.config"));
});

describe("DownloadLogService", () => {
  const getPrisma = () =>
    prismaMock as unknown as {
      user: { findUnique: jest.Mock };
      subscription: { findFirst: jest.Mock };
      usageLog: { count: jest.Mock; create: jest.Mock; groupBy: jest.Mock };
    };

  beforeEach(() => {
    const prisma = getPrisma();
    prisma.user.findUnique.mockReset();
    prisma.subscription.findFirst.mockReset();
    prisma.usageLog.count.mockReset();
    prisma.usageLog.create.mockReset();
    prisma.usageLog.groupBy.mockReset();
  });

  it("logs a CV PDF download to usage_logs", async () => {
    const prisma = getPrisma();
    prisma.user.findUnique.mockResolvedValue({
      createdAt: new Date("2026-01-01"),
    });

    await DownloadLogService.logDownload("user-1", "cv", "doc-1", "my-cv.pdf", "pdf");

    expect(prisma.usageLog.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        feature: "cv_download_pdf",
      },
    });
  });

  it("logs an application letter DOCX download to usage_logs", async () => {
    const prisma = getPrisma();

    await DownloadLogService.logDownload(
      "user-1",
      "application_letter",
      "doc-2",
      "letter.docx",
      "docx"
    );

    expect(prisma.usageLog.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        feature: "app_letter_download_docx",
      },
    });
  });

  it("returns plan-derived download stats for free plan", async () => {
    const prisma = getPrisma();
    prisma.user.findUnique.mockResolvedValue({
      subscriptionPlan: "free",
      createdAt: new Date("2026-01-01"),
    });
    prisma.subscription.findFirst.mockResolvedValue(null);
    prisma.usageLog.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);

    const stats = await DownloadLogService.getDownloadStats("admin-1");

    expect(stats).toMatchObject({
      cv: {
        limit: 10,
        used: 3,
        remaining: 7,
        total_count: 7,
      },
      application_letter: {
        limit: 10,
        used: 1,
        remaining: 9,
        total_count: 2,
      },
    });
  });

  it("counts downloads by multiple users", async () => {
    const prisma = getPrisma();
    prisma.usageLog.groupBy.mockResolvedValue([
      { userId: "user-1", _count: { _all: 5 } },
      { userId: "user-2", _count: { _all: 3 } },
    ]);

    const result = await DownloadLogService.countDownloadsByUsers(["user-1", "user-2"]);

    expect(result).toEqual({ "user-1": 5, "user-2": 3 });
  });
});
