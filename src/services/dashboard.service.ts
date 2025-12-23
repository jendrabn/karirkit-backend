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
        },
      }),

      // Active applications (not rejected or accepted)
      prisma.application.count({
        where: {
          userId,
          status: {
            notIn: ["rejected", "accepted"],
          },
        },
      }),

      // Inactive applications (rejected or accepted)
      prisma.application.count({
        where: {
          userId,
          status: {
            in: ["rejected", "accepted"],
          },
        },
      }),

      // Total application letters
      prisma.applicationLetter.count({
        where: {
          userId,
        },
      }),

      // Total CVs
      prisma.cv.count({
        where: {
          userId,
        },
      }),

      // Total portfolios
      prisma.portfolio.count({
        where: {
          userId,
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
