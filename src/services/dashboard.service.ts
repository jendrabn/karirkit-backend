import { prisma } from "../config/prisma.config";

export class DashboardService {
  static async getUserStats(userId: string): Promise<{
    total_applications: number;
    active_applications: number;
    inactive_applications: number;
    total_application_letters: number;
    total_cvs: number;
    total_portfolios: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day for comparison

    const [
      totalApplications,
      activeApplications,
      inactiveApplications,
      totalApplicationLetters,
      totalCvs,
      totalPortfolios,
    ] = await Promise.all([
      // Total applications
      prisma.application.count({
        where: {
          userId,
          deletedAt: null,
        },
      }),

      // Active applications (not rejected or accepted)
      prisma.application.count({
        where: {
          userId,
          deletedAt: null,
          status: {
            notIn: ["rejected", "accepted"],
          },
        },
      }),

      // Inactive applications (rejected or accepted)
      prisma.application.count({
        where: {
          userId,
          deletedAt: null,
          status: {
            in: ["rejected", "accepted"],
          },
        },
      }),

      // Total application letters
      prisma.applicationLetter.count({
        where: {
          userId,
          deletedAt: null,
        },
      }),

      // Total CVs
      prisma.cv.count({
        where: {
          userId,
          deletedAt: null,
        },
      }),

      // Total portfolios
      prisma.portfolio.count({
        where: {
          userId,
          deletedAt: null,
        },
      }),
    ]);

    return {
      total_applications: totalApplications,
      active_applications: activeApplications,
      inactive_applications: inactiveApplications,
      total_application_letters: totalApplicationLetters,
      total_cvs: totalCvs,
      total_portfolios: totalPortfolios,
    };
  }
}
