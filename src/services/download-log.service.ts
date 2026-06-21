import { UsageFeature } from "../generated/prisma/client";
import { prisma } from "../config/prisma.config";
import {
  getPlan,
  resolvePlanId,
  type PlanId,
} from "../config/subscription-plans.config";
import { getPeriodStart } from "../utils/subscription-period.util";

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

const getPlanDownloadLimits = (planId: PlanId) => {
  const plan = getPlan(planId);
  return {
    cv: { pdf: plan.maxCvPdfDownloads, docx: plan.maxCvDocxDownloads },
    application_letter: { pdf: plan.maxLetterPdfDownloads, docx: plan.maxLetterDocxDownloads },
  };
};

const kindToFeature = (
  kind: DownloadKind,
  format: DownloadFormat
): UsageFeature => {
  if (kind === "cv") {
    return format === "pdf"
      ? UsageFeature.cv_download_pdf
      : UsageFeature.cv_download_docx;
  }
  return format === "pdf"
    ? UsageFeature.app_letter_download_pdf
    : UsageFeature.app_letter_download_docx;
};

export class DownloadLogService {
  static async logDownload(
    userId: string,
    type: DownloadKind,
    _documentId: string,
    _documentName: string,
    format: DownloadFormat
  ): Promise<void> {
    await prisma.usageLog.create({
      data: {
        userId,
        feature: kindToFeature(type, format),
      },
    });
  }

  static async getDownloadStats(userId: string): Promise<DownloadStats> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionPlan: true },
    });

    const planId = resolvePlanId(user!.subscriptionPlan);
    const limits = getPlanDownloadLimits(planId);
    const periodStart = await getPeriodStart(userId);

    const buildBucket = async (
      type: DownloadKind,
      format: DownloadFormat
    ): Promise<DownloadStatsBucket> => {
      const limit = limits[type][format];
      const feature = kindToFeature(type, format);
      const [used, totalCount] = await Promise.all([
        prisma.usageLog.count({
          where: {
            userId,
            feature,
            createdAt: { gte: periodStart },
          },
        }),
        prisma.usageLog.count({
          where: { userId, feature },
        }),
      ]);
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

    const where: {
      userId: { in: string[] };
      createdAt?: { gte: Date };
      feature?: UsageFeature;
    } = {
      userId: { in: userIds },
    };

    if (since) {
      where.createdAt = { gte: since };
    }

    if (type && format) {
      where.feature = kindToFeature(type, format);
    }

    const groups = await prisma.usageLog.groupBy({
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
