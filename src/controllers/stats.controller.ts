import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma.config";
import { sendSuccess } from "../utils/response-builder.util";

export class StatsController {
  static async getStats(_req: Request, res: Response, next: NextFunction) {
    try {
      // Get total users with 'user' role
      const totalUsers = await prisma.user.count({
        where: {
          role: "user",
          deletedAt: null,
        },
      });

      // Get total CVs
      const totalCvs = await prisma.cv.count({
        where: {
          deletedAt: null,
        },
      });

      // Get total application letters
      const totalApplicationLetters = await prisma.applicationLetter.count({
        where: {
          deletedAt: null,
        },
      });

      // Get total applications
      const totalApplications = await prisma.application.count({
        where: {
          deletedAt: null,
        },
      });

      // Dummy values for now
      const totalCvTemplates = 7;
      const totalApplicationLetterTemplates = 10;

      const stats = {
        total_users: totalUsers,
        total_cvs: totalCvs,
        total_application_letters: totalApplicationLetters,
        total_applications: totalApplications,
        total_cv_templates: totalCvTemplates,
        total_application_letter_templates: totalApplicationLetterTemplates,
      };

      return sendSuccess(res, stats);
    } catch (error) {
      next(error);
    }
  }
}
