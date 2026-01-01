import { prisma } from "../config/prisma.config";
import { ResponseError } from "../utils/response-error.util";
import { DownloadType, UserRole, type Prisma } from "../generated/prisma/client";

export interface DownloadStats {
  daily_limit: number;
  today_count: number;
  remaining: number;
  total_count: number;
}

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

  static async getDownloadStats(userId: string): Promise<DownloadStats> {
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

    const totalCount = await prisma.downloadLog.count({
      where: {
        userId: userId,
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
      total_count: totalCount,
    };
  }

  static async countDownloadsByUsers(
    userIds: string[],
    since?: Date
  ): Promise<Record<string, number>> {
    if (userIds.length === 0) {
      return {};
    }

    const where: Prisma.DownloadLogWhereInput = {
      userId: { in: userIds },
    };

    if (since) {
      where.downloadedAt = {
        gte: since,
      };
    }

    const groups = await prisma.downloadLog.groupBy({
      by: ["userId"],
      where,
      _count: {
        _all: true,
      },
    });

    const result: Record<string, number> = {};
    for (const group of groups) {
      result[group.userId] = group._count._all;
    }

    return result;
  }
}
