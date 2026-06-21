import { UsageFeature } from "../generated/prisma/client";
import { prisma } from "../config/prisma.config";
import {
  getPlan,
  resolvePlanId,
  type PlanId,
  type SubscriptionPlan,
} from "../config/subscription-plans.config";
import { getPeriodStart } from "../utils/subscription-period.util";

export type UsageBucket = {
  limit: number;
  used: number;
  remaining: number;
};

export type UsageStats = {
  max_cvs: UsageBucket;
  max_application_letters: UsageBucket;
  max_applications: UsageBucket;
  max_document_storage_bytes: UsageBucket;
  max_cv_pdf_downloads: UsageBucket;
  max_cv_docx_downloads: UsageBucket;
  max_letter_pdf_downloads: UsageBucket;
  max_letter_docx_downloads: UsageBucket;
  max_cv_ai_improvements: UsageBucket;
  max_application_letter_ai_improvements: UsageBucket;
  can_use_premium_cv_templates: boolean;
  can_use_premium_application_letter_templates: boolean;
};

const ALL_FEATURES: UsageFeature[] = [
  UsageFeature.cv_download_pdf,
  UsageFeature.cv_download_docx,
  UsageFeature.app_letter_download_pdf,
  UsageFeature.app_letter_download_docx,
  UsageFeature.ai_improve_cv,
  UsageFeature.ai_improve_app_letter,
];

type CountMap = Record<string, number>;

const bucket = (limit: number, used: number): UsageBucket => ({
  limit,
  used,
  remaining: Math.max(0, limit - used),
});

const buildStats = (
  plan: SubscriptionPlan,
  cvCount: number,
  letterCount: number,
  appCount: number,
  storageUsed: number,
  usageCounts: CountMap
): UsageStats => ({
  max_cvs: bucket(plan.maxCvs, cvCount),
  max_application_letters: bucket(plan.maxApplicationLetters, letterCount),
  max_applications: bucket(plan.maxApplications, appCount),
  max_document_storage_bytes: bucket(plan.maxDocumentStorageBytes, storageUsed),
  max_cv_pdf_downloads: bucket(
    plan.maxCvPdfDownloads,
    usageCounts[UsageFeature.cv_download_pdf] ?? 0
  ),
  max_cv_docx_downloads: bucket(
    plan.maxCvDocxDownloads,
    usageCounts[UsageFeature.cv_download_docx] ?? 0
  ),
  max_letter_pdf_downloads: bucket(
    plan.maxLetterPdfDownloads,
    usageCounts[UsageFeature.app_letter_download_pdf] ?? 0
  ),
  max_letter_docx_downloads: bucket(
    plan.maxLetterDocxDownloads,
    usageCounts[UsageFeature.app_letter_download_docx] ?? 0
  ),
  max_cv_ai_improvements: bucket(
    plan.maxCvAiImprovements,
    usageCounts[UsageFeature.ai_improve_cv] ?? 0
  ),
  max_application_letter_ai_improvements: bucket(
    plan.maxApplicationLetterAiImprovements,
    usageCounts[UsageFeature.ai_improve_app_letter] ?? 0
  ),
  can_use_premium_cv_templates: plan.canUsePremiumCvTemplates,
  can_use_premium_application_letter_templates:
    plan.canUsePremiumApplicationLetterTemplates,
});

const fetchPlanId = async (userId: string): Promise<PlanId> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionPlan: true },
  });
  return resolvePlanId(user?.subscriptionPlan);
};

const fetchUsageCounts = async (
  userId: string,
  since?: Date
): Promise<CountMap> => {
  const where: Record<string, unknown> = {
    userId,
    feature: { in: ALL_FEATURES },
  };
  if (since) where.createdAt = { gte: since };

  const groups = await prisma.usageLog.groupBy({
    by: ["feature"],
    where: where as any,
    _count: { _all: true },
  });

  const result: CountMap = {};
  for (const g of groups) {
    result[g.feature] = g._count._all;
  }
  return result;
};

const fetchBatchUsageCounts = async (
  userIds: string[],
  since?: Date
): Promise<Record<string, CountMap>> => {
  if (userIds.length === 0) return {};

  const where: Record<string, unknown> = {
    userId: { in: userIds },
    feature: { in: ALL_FEATURES },
  };
  if (since) where.createdAt = { gte: since };

  const groups = await prisma.usageLog.groupBy({
    by: ["userId", "feature"],
    where: where as any,
    _count: { _all: true },
  });

  const result: Record<string, CountMap> = {};
  for (const uid of userIds) result[uid] = {};
  for (const g of groups) {
    if (!result[g.userId]) result[g.userId] = {};
    result[g.userId][g.feature] = g._count._all;
  }
  return result;
};

export class UsageStatsService {
  static async getPeriodUsageStats(userId: string): Promise<UsageStats> {
    const [planId, periodStart] = await Promise.all([
      fetchPlanId(userId),
      getPeriodStart(userId),
    ]);
    const plan = getPlan(planId);

    const [cvCount, letterCount, appCount, storageUsage, usageCounts] =
      await Promise.all([
        prisma.cv.count({ where: { userId } }),
        prisma.applicationLetter.count({ where: { userId } }),
        prisma.application.count({ where: { userId } }),
        prisma.document.aggregate({
          where: { userId },
          _sum: { size: true },
        }),
        fetchUsageCounts(userId, periodStart),
      ]);

    return buildStats(
      plan,
      cvCount,
      letterCount,
      appCount,
      storageUsage._sum.size ?? 0,
      usageCounts
    );
  }

  static async getLifetimeUsageStats(userId: string): Promise<UsageStats> {
    const planId = await fetchPlanId(userId);
    const plan = getPlan(planId);

    const [cvCount, letterCount, appCount, storageUsage, usageCounts] =
      await Promise.all([
        prisma.cv.count({ where: { userId } }),
        prisma.applicationLetter.count({ where: { userId } }),
        prisma.application.count({ where: { userId } }),
        prisma.document.aggregate({
          where: { userId },
          _sum: { size: true },
        }),
        fetchUsageCounts(userId),
      ]);

    return buildStats(
      plan,
      cvCount,
      letterCount,
      appCount,
      storageUsage._sum.size ?? 0,
      usageCounts
    );
  }

  static async getBatchLifetimeUsageStats(
    userIds: string[]
  ): Promise<Record<string, UsageStats>> {
    if (userIds.length === 0) return {};

    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, subscriptionPlan: true },
    });

    const planMap: Record<string, PlanId> = {};
    for (const u of users) {
      planMap[u.id] = resolvePlanId(u.subscriptionPlan);
    }

    const [cvs, letters, apps, storageRows, usageMap] = await Promise.all([
      prisma.cv.groupBy({
        by: ["userId"],
        where: { userId: { in: userIds } },
        _count: { _all: true },
      }),
      prisma.applicationLetter.groupBy({
        by: ["userId"],
        where: { userId: { in: userIds } },
        _count: { _all: true },
      }),
      prisma.application.groupBy({
        by: ["userId"],
        where: { userId: { in: userIds } },
        _count: { _all: true },
      }),
      prisma.document.groupBy({
        by: ["userId"],
        where: { userId: { in: userIds } },
        _sum: { size: true },
      }),
      fetchBatchUsageCounts(userIds),
    ]);

    const cvMap: Record<string, number> = {};
    const letterMap: Record<string, number> = {};
    const appMap: Record<string, number> = {};
    const storageMap: Record<string, number> = {};

    for (const row of cvs) cvMap[row.userId] = row._count._all;
    for (const row of letters) letterMap[row.userId] = row._count._all;
    for (const row of apps) appMap[row.userId] = row._count._all;
    for (const row of storageRows) storageMap[row.userId] = row._sum.size ?? 0;

    const result: Record<string, UsageStats> = {};
    for (const userId of userIds) {
      const planId = planMap[userId] ?? "free";
      const plan = getPlan(planId);
      result[userId] = buildStats(
        plan,
        cvMap[userId] ?? 0,
        letterMap[userId] ?? 0,
        appMap[userId] ?? 0,
        storageMap[userId] ?? 0,
        usageMap[userId] ?? {}
      );
    }
    return result;
  }
}
