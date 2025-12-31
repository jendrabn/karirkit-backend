import { prisma } from "../config/prisma.config";
import { ResponseError } from "../utils/response-error.util";
import { DownloadType, UserRole } from "../generated/prisma/client";

export class DownloadLogService {
  static async checkDownloadLimit(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { dailyDownloadLimit: true, role: true },
    });

    if (!user) {
      throw new ResponseError(404, "User not found");
    }

    if (user.role === UserRole.admin) {
      return;
    }

    // Reset at 00:00 server time
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const downloadCount = await prisma.downloadLog.count({
      where: {
        userId: userId,
        downloadedAt: {
          gte: today,
        },
      },
    });

    if (downloadCount >= user.dailyDownloadLimit) {
      throw new ResponseError(
        429,
        `Batas unduhan harian tercapai. Anda sudah mengunduh ${downloadCount} dari ${user.dailyDownloadLimit} dokumen hari ini. Silakan coba lagi besok.`
      );
    }
  }

  static async logDownload(
    userId: string,
    type: DownloadType,
    documentId: string,
    documentName: string
  ): Promise<void> {
    await prisma.downloadLog.create({
      data: {
        userId,
        type,
        documentId,
        documentName,
      },
    });
  }

  static async getDownloadStats(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { dailyDownloadLimit: true, role: true },
    });

    if (!user) {
      throw new ResponseError(404, "User not found");
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayCount = await prisma.downloadLog.count({
      where: {
        userId: userId,
        downloadedAt: {
          gte: today,
        },
      },
    });

    return {
      daily_limit:
        user.role === UserRole.admin ? 999999 : user.dailyDownloadLimit,
      today_count: todayCount,
      remaining:
        user.role === UserRole.admin
          ? 999999
          : Math.max(0, user.dailyDownloadLimit - todayCount),
    };
  }
}
