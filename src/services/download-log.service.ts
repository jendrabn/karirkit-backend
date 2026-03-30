import { prisma } from "../config/prisma.config";
import { ResponseError } from "../utils/response-error.util";
import type { Prisma } from "../generated/prisma/client";
import type { DownloadLogWhereInput } from "../generated/prisma/models/DownloadLog";
import {
  type DownloadKind,
  getCombinedDownloadLimit,
  getDownloadLimit,
  getPdfDownloadLimit,
  getPlan,
  isUnlimitedLimit,
  resolvePlanId,
} from "../config/subscription-plans.config";

export type DownloadFormat = "pdf" | "docx";

export interface DownloadStatsBucket {
  daily_limit: number;
  today_count: number;
  remaining: number;
  total_count: number;
}

export interface DownloadStats extends DownloadStatsBucket {
  cv: DownloadStatsBucket;
  application_letter: DownloadStatsBucket;
}

const getDownloadLabel = (type: DownloadKind): string =>
  type === "cv" ? "CV" : "surat lamaran";

const getPdfDownloadLabel = (type: DownloadKind): string =>
  type === "cv" ? "PDF CV" : "PDF surat lamaran";

const buildBucketStats = (
  limit: number,
  todayCount: number,
  totalCount: number
): DownloadStatsBucket => ({
  daily_limit: limit,
  today_count: todayCount,
  remaining: isUnlimitedLimit(limit) ? -1 : Math.max(0, limit - todayCount),
  total_count: totalCount,
});

export class DownloadLogService {
  static async checkDownloadLimit(
    userId: string,
    type: DownloadKind,
    format: DownloadFormat
  ): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionPlan: true },
    });

    if (!user) {
      throw new ResponseError(404, "User not found");
    }

    const planId = resolvePlanId(user.subscriptionPlan);
    const plan = getPlan(planId);

    if (type === "cv" && !plan.canDownloadCvPdf) {
      throw new ResponseError(403, "Fitur download CV belum tersedia");
    }

    if (
      type === "application_letter" &&
      !plan.canDownloadApplicationLetterPdf
    ) {
      throw new ResponseError(
        403,
        "Fitur download surat lamaran belum tersedia"
      );
    }

    const dailyDownloadLimit = getDownloadLimit(planId, type);
    // Reset at 00:00 server time
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!isUnlimitedLimit(dailyDownloadLimit)) {
      const downloadCount = await prisma.downloadLog.count({
        where: {
          userId,
          type,
          downloadedAt: {
            gte: today,
          },
        },
      });

      if (downloadCount >= dailyDownloadLimit) {
        throw new ResponseError(
          429,
          `Batas unduhan harian ${getDownloadLabel(type)} tercapai. Anda sudah mengunduh ${downloadCount} dari ${dailyDownloadLimit} dokumen hari ini. Silakan coba lagi besok.`
        );
      }
    }

    if (format === "pdf") {
      const pdfDownloadLimit = getPdfDownloadLimit(planId, type);
      if (isUnlimitedLimit(pdfDownloadLimit)) {
        return;
      }

      const pdfDownloadCount = await prisma.downloadLog.count({
        where: {
          userId,
          type,
          format: "pdf",
          downloadedAt: {
            gte: today,
          },
        },
      });

      if (pdfDownloadCount >= pdfDownloadLimit) {
        throw new ResponseError(
          429,
          `Batas unduhan harian ${getPdfDownloadLabel(type)} tercapai. Anda sudah mengunduh ${pdfDownloadCount} dari ${pdfDownloadLimit} dokumen hari ini. Silakan coba lagi besok.`
        );
      }
    }
  }

  static async logDownload(
    userId: string,
    type: DownloadKind,
    documentId: string,
    documentName: string,
    format: DownloadFormat
  ): Promise<void> {
    await prisma.downloadLog.create({
      data: {
        userId,
        type,
        format,
        documentId,
        documentName,
      },
    });
  }

  static async getDownloadStats(userId: string): Promise<DownloadStats> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionPlan: true },
    });

    if (!user) {
      throw new ResponseError(404, "User not found");
    }

    const planId = resolvePlanId(user.subscriptionPlan);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayCvCount, todayApplicationLetterCount, totalCvCount, totalApplicationLetterCount] =
      await Promise.all([
        prisma.downloadLog.count({
          where: {
            userId,
            type: "cv",
            downloadedAt: {
              gte: today,
            },
          },
        }),
        prisma.downloadLog.count({
          where: {
            userId,
            type: "application_letter",
            downloadedAt: {
              gte: today,
            },
          },
        }),
        prisma.downloadLog.count({
          where: {
            userId,
            type: "cv",
          },
        }),
        prisma.downloadLog.count({
          where: {
            userId,
            type: "application_letter",
          },
        }),
      ]);

    const cvStats = buildBucketStats(
      getDownloadLimit(planId, "cv"),
      todayCvCount,
      totalCvCount
    );
    const applicationLetterStats = buildBucketStats(
      getDownloadLimit(planId, "application_letter"),
      todayApplicationLetterCount,
      totalApplicationLetterCount
    );
    const totalTodayCount = todayCvCount + todayApplicationLetterCount;
    const totalCount = totalCvCount + totalApplicationLetterCount;
    const combinedLimit = getCombinedDownloadLimit(planId);
    const summary = buildBucketStats(
      combinedLimit,
      totalTodayCount,
      totalCount
    );

    return {
      ...summary,
      cv: cvStats,
      application_letter: applicationLetterStats,
    };
  }

  static async countDownloadsByUsers(
    userIds: string[],
    since?: Date,
    type?: DownloadKind,
    format?: DownloadFormat
  ): Promise<Record<string, number>> {
    if (userIds.length === 0) {
      return {};
    }

    const where: DownloadLogWhereInput = {
      userId: { in: userIds },
    };

    if (since) {
      where.downloadedAt = {
        gte: since,
      };
    }

    if (type) {
      where.type = type;
    }

    if (format) {
      where.format = format;
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
