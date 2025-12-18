import { Request, Response, NextFunction } from "express";
import { PublicPortfolioService } from "../services/public-portfolio.service";
import { sendSuccess } from "../utils/response-builder.util";
import { prisma } from "../config/prisma.config";
import { TemplateService } from "../services/template.service";

export class PublicController {
  static async getPortfolioListing(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const result = await PublicPortfolioService.listByUsername(
        req.params.username
      );
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async getPortfolioDetail(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const result = await PublicPortfolioService.getPortfolioDetail(
        req.params.username,
        req.params.id
      );
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

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

  static async getTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      const { type, language } = req.query;

      const templates = await TemplateService.getTemplates({
        type: type as "cv" | "application_letter",
        language: language as "en" | "id",
      });

      return sendSuccess(res, {
        items: templates,
      });
    } catch (error) {
      next(error);
    }
  }
}
