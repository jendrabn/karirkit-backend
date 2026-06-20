import { prisma } from "../config/prisma.config";
import { ResponseError } from "../utils/response-error.util";
import type { DownloadLogWhereInput } from "../generated/prisma/models/DownloadLog";
import {
  getPlan,
  resolvePlanId,
  type PlanId,
} from "../config/subscription-plans.config";
import {
  SubscriptionStatus,
} from "../generated/prisma/client";

type DownloadKind = "cv" | "application_letter";
type DownloadFormat = "pdf" | "docx";

export interface DownloadStatsBucket {
  limit: number;
  used: number;
  remaining: number;
  total_count: number;
}

export interface DownloadStats {
  cv: DownloadStatsBucket;
  application_letter: DownloadStatsBucket;
}

const getDownloadLabel = (type: DownloadKind): string =>
  type === "cv" ? "CV" : "surat lamaran";

const getFormatLabel = (type: DownloadKind, format: DownloadFormat): string => {
  const docType = getDownloadLabel(type);
  return `${format.toUpperCase()} ${docType}`;
};

const getPlanDownloadLimits = (planId: PlanId) => {
  const plan = getPlan(planId);
  return {
    cv: { pdf: plan.maxCvPdfDownloads, docx: plan.maxCvDocxDownloads },
    application_letter: { pdf: plan.maxLetterPdfDownloads, docx: plan.maxLetterDocxDownloads },
  };
};

const getSubscriptionPeriodStart = async (
  userId: string
): Promise<Date | undefined> => {
  const activeSubscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: SubscriptionStatus.paid,
      OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
    },
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    select: { paidAt: true },
  });

  return activeSubscription?.paidAt ?? undefined;
};

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
    const limits = getPlanDownloadLimits(planId);
    const typeLimits = limits[type];
    const formatLimit = typeLimits[format];

    const periodStart = await getSubscriptionPeriodStart(userId);

    const where: Parameters<typeof prisma.downloadLog.count>[0] = {
      where: {
        userId,
        type,
        format,
        ...(periodStart ? { downloadedAt: { gte: periodStart } } : {}),
      },
    };

    const usedCount = await prisma.downloadLog.count(where);

    if (usedCount >= formatLimit) {
      throw new ResponseError(
        429,
        `Batas unduhan ${getFormatLabel(type, format)} tercapai. Anda sudah mengunduh ${usedCount} dari ${formatLimit} dokumen. Silakan tingkatkan paket langganan atau tunggu periode berlangganan berikutnya.`
      );
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
    const limits = getPlanDownloadLimits(planId);
    const periodStart = await getSubscriptionPeriodStart(userId);

    const periodFilter = periodStart ? { downloadedAt: { gte: periodStart } } : {};

    const buildBucket = async (
      type: DownloadKind,
      format: DownloadFormat
    ): Promise<DownloadStatsBucket> => {
      const limit = limits[type][format];
      const used = await prisma.downloadLog.count({
        where: { userId, type, format, ...periodFilter },
      });
      const totalCount = await prisma.downloadLog.count({
        where: { userId, type, format },
      });
      return {
        limit,
        used,
        remaining: Math.max(0, limit - used),
        total_count: totalCount,
      };
    };

    return {
      cv: await buildBucket("cv", "pdf"),
      application_letter: await buildBucket("application_letter", "pdf"),
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
