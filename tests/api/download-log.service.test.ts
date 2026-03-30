let DownloadLogService: typeof import("../../src/services/download-log.service").DownloadLogService;
let prismaMock: typeof import("../../src/config/prisma.config").prisma;

beforeAll(async () => {
  jest.resetModules();
  jest.doMock("../../src/config/prisma.config", () => ({
    prisma: {
      user: { findUnique: jest.fn() },
      downloadLog: { count: jest.fn(), create: jest.fn(), groupBy: jest.fn() },
    },
  }));

  ({ DownloadLogService } = await import("../../src/services/download-log.service"));
  ({ prisma: prismaMock } = await import("../../src/config/prisma.config"));
});

describe("DownloadLogService", () => {
  const getPrisma = () =>
    prismaMock as unknown as {
      user: { findUnique: jest.Mock };
      downloadLog: { count: jest.Mock };
    };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("enforces daily CV download limits for admins on free plan", async () => {
    const prisma = getPrisma();
    prisma.user.findUnique.mockResolvedValue({
      subscriptionPlan: "free",
    });
    prisma.downloadLog.count.mockResolvedValue(5);

    await expect(
      DownloadLogService.checkDownloadLimit("admin-1", "cv", "pdf")
    ).rejects.toMatchObject({
      statusCode: 429,
      message: expect.stringContaining("Batas unduhan harian CV tercapai"),
    });
  });

  it("keeps unlimited download access for admins on max plan because the plan is unlimited", async () => {
    const prisma = getPrisma();
    prisma.user.findUnique.mockResolvedValue({
      subscriptionPlan: "max",
    });

    await expect(
      DownloadLogService.checkDownloadLimit("admin-1", "cv", "pdf")
    ).resolves.toBeUndefined();
    expect(prisma.downloadLog.count).not.toHaveBeenCalled();
  });

  it("enforces daily PDF-specific download limits separately from the total type limit", async () => {
    const prisma = getPrisma();
    prisma.user.findUnique.mockResolvedValue({
      subscriptionPlan: "free",
    });
    prisma.downloadLog.count
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(5);

    await expect(
      DownloadLogService.checkDownloadLimit("user-1", "cv", "pdf")
    ).rejects.toMatchObject({
      statusCode: 429,
      message: expect.stringContaining("Batas unduhan harian PDF CV tercapai"),
    });
  });

  it("returns plan-derived download stats for admins without special casing", async () => {
    const prisma = getPrisma();
    prisma.user.findUnique.mockResolvedValue({
      subscriptionPlan: "free",
    });
    prisma.downloadLog.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(2);

    const stats = await DownloadLogService.getDownloadStats("admin-1");

    expect(stats).toMatchObject({
      daily_limit: 10,
      today_count: 4,
      remaining: 6,
      total_count: 9,
      cv: {
        daily_limit: 5,
        today_count: 3,
        remaining: 2,
        total_count: 7,
      },
      application_letter: {
        daily_limit: 5,
        today_count: 1,
        remaining: 4,
        total_count: 2,
      },
    });
  });
});
