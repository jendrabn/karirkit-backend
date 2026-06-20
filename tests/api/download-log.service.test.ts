let DownloadLogService: typeof import("../../src/services/download-log.service").DownloadLogService;
let prismaMock: typeof import("../../src/config/prisma.config").prisma;
let SUBSCRIPTION_PLANS: typeof import("../../src/config/subscription-plans.config").SUBSCRIPTION_PLANS;

beforeAll(async () => {
  jest.resetModules();
  jest.doMock("../../src/config/prisma.config", () => ({
    prisma: {
      user: { findUnique: jest.fn() },
      subscription: { findFirst: jest.fn() },
      downloadLog: { count: jest.fn(), create: jest.fn(), groupBy: jest.fn() },
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
      downloadLog: { count: jest.Mock; create: jest.Mock; groupBy: jest.Mock };
    };

  beforeEach(() => {
    const prisma = getPrisma();
    prisma.user.findUnique.mockReset();
    prisma.subscription.findFirst.mockReset();
    prisma.downloadLog.count.mockReset();
    prisma.downloadLog.groupBy.mockReset();
  });

  it("enforces period-based PDF download limits for free plan", async () => {
    const prisma = getPrisma();
    prisma.user.findUnique.mockResolvedValue({
      subscriptionPlan: "free",
    });
    prisma.subscription.findFirst.mockResolvedValue(null);
    prisma.downloadLog.count.mockResolvedValue(10);

    await expect(
      DownloadLogService.checkDownloadLimit("user-1", "cv", "pdf")
    ).rejects.toMatchObject({
      statusCode: 429,
      message: expect.stringContaining("Batas unduhan PDF CV tercapai"),
    });
  });

  it("allows download when usage is below the limit", async () => {
    const prisma = getPrisma();
    prisma.user.findUnique.mockResolvedValue({
      subscriptionPlan: "free",
    });
    prisma.subscription.findFirst.mockResolvedValue(null);
    prisma.downloadLog.count.mockResolvedValue(5);

    await expect(
      DownloadLogService.checkDownloadLimit("user-1", "cv", "pdf")
    ).resolves.toBeUndefined();
  });

  it("returns 404 for unknown users", async () => {
    const prisma = getPrisma();
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      DownloadLogService.checkDownloadLimit("nonexistent", "cv", "pdf")
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("uses subscription period start when user has active subscription", async () => {
    const prisma = getPrisma();
    const paidAt = new Date("2026-06-01T00:00:00.000Z");
    prisma.user.findUnique.mockResolvedValue({
      subscriptionPlan: "pro",
    });
    prisma.subscription.findFirst.mockResolvedValue({ paidAt });
    prisma.downloadLog.count.mockResolvedValue(5);

    await expect(
      DownloadLogService.checkDownloadLimit("user-1", "cv", "pdf")
    ).resolves.toBeUndefined();

    expect(prisma.downloadLog.count).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        type: "cv",
        format: "pdf",
        downloadedAt: { gte: paidAt },
      },
    });
  });

  it("enforces application letter PDF download limits separately", async () => {
    const prisma = getPrisma();
    prisma.user.findUnique.mockResolvedValue({
      subscriptionPlan: "free",
    });
    prisma.subscription.findFirst.mockResolvedValue(null);
    prisma.downloadLog.count.mockResolvedValue(10);

    await expect(
      DownloadLogService.checkDownloadLimit("user-1", "application_letter", "pdf")
    ).rejects.toMatchObject({
      statusCode: 429,
      message: expect.stringContaining("Batas unduhan PDF surat lamaran tercapai"),
    });
  });

  it("enforces DOCX download limits separately from PDF limits", async () => {
    const prisma = getPrisma();
    prisma.user.findUnique.mockResolvedValue({
      subscriptionPlan: "free",
    });
    prisma.subscription.findFirst.mockResolvedValue(null);
    prisma.downloadLog.count.mockResolvedValue(3);

    await expect(
      DownloadLogService.checkDownloadLimit("user-1", "cv", "docx")
    ).rejects.toMatchObject({
      statusCode: 429,
      message: expect.stringContaining("Batas unduhan DOCX CV tercapai"),
    });
  });

  it("returns plan-derived download stats for admins", async () => {
    const prisma = getPrisma();
    prisma.user.findUnique.mockResolvedValue({
      subscriptionPlan: "free",
    });
    prisma.subscription.findFirst.mockResolvedValue(null);
    prisma.downloadLog.count
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
});
