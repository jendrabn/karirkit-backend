import { prisma } from "../config/prisma.config";
import {
  getPlan,
  isUnlimitedLimit,
  resolvePlanId,
} from "../config/subscription-plans.config";
import { ResponseError } from "../utils/response-error.util";
import { DownloadLogService } from "./download-log.service";

export type UserDashboardStats = {
  total_applications: number;
  active_applications: number;
  inactive_applications: number;
  interview_applications: number;
  offer_applications: number;
  accepted_applications: number;
  rejected_applications: number;
  needs_followup_applications: number;
  overdue_applications: number;
  no_followup_applications: number;
  total_application_letters: number;
  total_cvs: number;
  total_portfolios: number;
  total_documents: number;
  saved_jobs_count: number;
  subscription_plan: string;
  subscription_expires_at: string | null;
  download_today_count: number;
  download_total_count: number;
  document_storage_limit: number;
  document_storage_used: number;
  document_storage_remaining: number;
};

const getTodayStart = (): Date => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

export class DashboardService {
  static async getUserStats(userId: string): Promise<UserDashboardStats> {
    const today = getTodayStart();

    const [
      user,
      totalApplications,
      activeApplications,
      inactiveApplications,
      interviewApplications,
      offerApplications,
      acceptedApplications,
      rejectedApplications,
      needsFollowupApplications,
      overdueApplications,
      noFollowupApplications,
      totalApplicationLetters,
      totalCvs,
      totalPortfolios,
      totalDocuments,
      documentUsage,
      savedJobsCount,
      todayCounts,
      totalCounts,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          subscriptionPlan: true,
          subscriptionExpiresAt: true,
        },
      }),
      prisma.application.count({
        where: {
          userId,
        },
      }),
      prisma.application.count({
        where: {
          userId,
          status: {
            notIn: ["rejected", "accepted"],
          },
        },
      }),
      prisma.application.count({
        where: {
          userId,
          status: {
            in: ["rejected", "accepted"],
          },
        },
      }),
      prisma.application.count({
        where: {
          userId,
          status: {
            in: ["hr_interview", "user_interview", "final_interview"],
          },
        },
      }),
      prisma.application.count({
        where: {
          userId,
          status: "offering",
        },
      }),
      prisma.application.count({
        where: {
          userId,
          status: "accepted",
        },
      }),
      prisma.application.count({
        where: {
          userId,
          status: "rejected",
        },
      }),
      prisma.application.count({
        where: {
          userId,
          followUpDate: {
            not: null,
          },
        },
      }),
      prisma.application.count({
        where: {
          userId,
          followUpDate: {
            lt: today,
          },
          status: {
            notIn: ["rejected", "accepted"],
          },
        },
      }),
      prisma.application.count({
        where: {
          userId,
          followUpDate: null,
          status: {
            notIn: ["rejected", "accepted"],
          },
        },
      }),
      prisma.applicationLetter.count({
        where: {
          userId,
        },
      }),
      prisma.cv.count({
        where: {
          userId,
        },
      }),
      prisma.portfolio.count({
        where: {
          userId,
        },
      }),
      prisma.document.count({
        where: {
          userId,
        },
      }),
      prisma.document.aggregate({
        where: { userId },
        _sum: { size: true },
      }),
      prisma.savedJob.count({
        where: {
          userId,
        },
      }),
      DownloadLogService.countDownloadsByUsers([userId], today),
      DownloadLogService.countDownloadsByUsers([userId]),
    ]);

    if (!user) {
      throw new ResponseError(401, "Tidak terautentikasi");
    }

    const plan = getPlan(resolvePlanId(user.subscriptionPlan));
    const documentStorageUsed = documentUsage._sum.size ?? 0;
    const documentStorageLimit = plan.maxDocumentStorageBytes;
    const documentStorageRemaining = isUnlimitedLimit(documentStorageLimit)
      ? -1
      : Math.max(0, documentStorageLimit - documentStorageUsed);

    return {
      total_applications: totalApplications,
      active_applications: activeApplications,
      inactive_applications: inactiveApplications,
      interview_applications: interviewApplications,
      offer_applications: offerApplications,
      accepted_applications: acceptedApplications,
      rejected_applications: rejectedApplications,
      needs_followup_applications: needsFollowupApplications,
      overdue_applications: overdueApplications,
      no_followup_applications: noFollowupApplications,
      total_application_letters: totalApplicationLetters,
      total_cvs: totalCvs,
      total_portfolios: totalPortfolios,
      total_documents: totalDocuments,
      saved_jobs_count: savedJobsCount,
      subscription_plan: user.subscriptionPlan,
      subscription_expires_at: user.subscriptionExpiresAt
        ? user.subscriptionExpiresAt.toISOString()
        : null,
      download_today_count: todayCounts[userId] ?? 0,
      download_total_count: totalCounts[userId] ?? 0,
      document_storage_limit: documentStorageLimit,
      document_storage_used: documentStorageUsed,
      document_storage_remaining: documentStorageRemaining,
    };
  }
}
