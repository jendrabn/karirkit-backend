import type { NextFunction, Request, Response } from "express";
import { UsageFeature } from "../generated/prisma/client";
import env from "../config/env.config";
import { prisma } from "../config/prisma.config";
import {
  getPlan,
  resolvePlanId,
} from "../config/subscription-plans.config";
import { ResponseError } from "../utils/response-error.util";
import { getPeriodStart } from "../utils/subscription-period.util";

const getAuthenticatedUser = (req: Request) => {
  if (!req.user) {
    throw new ResponseError(401, "Unauthenticated");
  }

  return req.user;
};

const getUserPlan = (req: Request) => {
  const user = getAuthenticatedUser(req);
  return getPlan(resolvePlanId(user.subscriptionPlan));
};

const getTemplateIdFromBody = (req: Request): string | undefined => {
  return typeof req.body?.template_id === "string"
    ? req.body.template_id
    : undefined;
};

const getUsageCount = async (
  userId: string,
  feature: UsageFeature,
  since: Date
): Promise<number> => {
  return prisma.usageLog.count({
    where: {
      userId,
      feature,
      createdAt: { gte: since },
    },
  });
};

export const checkCvLimit = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getAuthenticatedUser(req);
    const cvLimit = getUserPlan(req).maxCvs;

    const currentCount = await prisma.cv.count({
      where: { userId: user.id },
    });

    if (currentCount >= cvLimit) {
      throw new ResponseError(
        403,
        "User telah mencapai batas maksimum CV",
        undefined,
        { code: "CV_LIMIT_REACHED" }
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const checkApplicationLetterLimit = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getAuthenticatedUser(req);
    const applicationLetterLimit = getUserPlan(req).maxApplicationLetters;

    const currentCount = await prisma.applicationLetter.count({
      where: { userId: user.id },
    });

    if (currentCount >= applicationLetterLimit) {
      throw new ResponseError(
        403,
        "Batas maksimum surat lamaran telah tercapai",
        undefined,
        { code: "APP_LETTER_LIMIT_REACHED" }
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const checkApplicationTrackerLimit = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getAuthenticatedUser(req);
    const applicationLimit = getUserPlan(req).maxApplications;

    const currentCount = await prisma.application.count({
      where: { userId: user.id },
    });

    if (currentCount >= applicationLimit) {
      throw new ResponseError(
        403,
        "Batas maksimum application tracker telah tercapai",
        undefined,
        { code: "APPLICATION_LIMIT_REACHED" }
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const checkCvDownloadLimit = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getAuthenticatedUser(req);
    const rawFormat = Array.isArray(req.query.format)
      ? req.query.format[0]
      : req.query.format;
    const format = typeof rawFormat === "string" ? rawFormat : "docx";

    const normalized = format.trim().toLowerCase();
    if (normalized !== "pdf" && normalized !== "docx") {
      throw new ResponseError(
        400,
        "Format unduhan tidak didukung",
        undefined,
        { code: "INVALID_DOWNLOAD_FORMAT" }
      );
    }

    const plan = getUserPlan(req);
    const limit =
      normalized === "pdf" ? plan.maxCvPdfDownloads : plan.maxCvDocxDownloads;
    const feature =
      normalized === "pdf"
        ? UsageFeature.cv_download_pdf
        : UsageFeature.cv_download_docx;

    const periodStart = await getPeriodStart(user.id);
    const usedCount = await getUsageCount(user.id, feature, periodStart);

    if (usedCount >= limit) {
      throw new ResponseError(
        429,
        `Batas unduhan ${normalized.toUpperCase()} CV tercapai. Anda sudah mengunduh ${usedCount} dari ${limit} dokumen. Silakan tingkatkan paket langganan atau tunggu periode berlangganan berikutnya.`,
        undefined,
        { code: "DOWNLOAD_LIMIT_REACHED" }
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const checkLetterDownloadLimit = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getAuthenticatedUser(req);
    const rawFormat = Array.isArray(req.query.format)
      ? req.query.format[0]
      : req.query.format;
    const format = typeof rawFormat === "string" ? rawFormat : "docx";

    const normalized = format.trim().toLowerCase();
    if (normalized !== "pdf" && normalized !== "docx") {
      throw new ResponseError(
        400,
        "Format unduhan tidak didukung",
        undefined,
        { code: "INVALID_DOWNLOAD_FORMAT" }
      );
    }

    const plan = getUserPlan(req);
    const limit =
      normalized === "pdf"
        ? plan.maxLetterPdfDownloads
        : plan.maxLetterDocxDownloads;
    const feature =
      normalized === "pdf"
        ? UsageFeature.app_letter_download_pdf
        : UsageFeature.app_letter_download_docx;

    const periodStart = await getPeriodStart(user.id);
    const usedCount = await getUsageCount(user.id, feature, periodStart);

    if (usedCount >= limit) {
      throw new ResponseError(
        429,
        `Batas unduhan ${normalized.toUpperCase()} surat lamaran tercapai. Anda sudah mengunduh ${usedCount} dari ${limit} dokumen. Silakan tingkatkan paket langganan atau tunggu periode berlangganan berikutnya.`,
        undefined,
        { code: "DOWNLOAD_LIMIT_REACHED" }
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const checkCvAiImproveLimit = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getAuthenticatedUser(req);
    const plan = getUserPlan(req);

    const periodStart = await getPeriodStart(user.id);
    const usedCount = await getUsageCount(
      user.id,
      UsageFeature.ai_improve_cv,
      periodStart
    );

    if (usedCount >= plan.maxCvAiImprovements) {
      throw new ResponseError(
        429,
        `Batas perbaikan AI CV tercapai. Anda sudah menggunakan ${usedCount} dari ${plan.maxCvAiImprovements} perbaikan. Silakan tingkatkan paket langganan atau tunggu periode berlangganan berikutnya.`,
        undefined,
        { code: "AI_LIMIT_REACHED" }
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const checkLetterAiImproveLimit = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getAuthenticatedUser(req);
    const plan = getUserPlan(req);

    const periodStart = await getPeriodStart(user.id);
    const usedCount = await getUsageCount(
      user.id,
      UsageFeature.ai_improve_app_letter,
      periodStart
    );

    if (usedCount >= plan.maxApplicationLetterAiImprovements) {
      throw new ResponseError(
        429,
        `Batas perbaikan AI surat lamaran tercapai. Anda sudah menggunakan ${usedCount} dari ${plan.maxApplicationLetterAiImprovements} perbaikan. Silakan tingkatkan paket langganan atau tunggu periode berlangganan berikutnya.`,
        undefined,
        { code: "AI_LIMIT_REACHED" }
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const checkPremiumTemplate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    getAuthenticatedUser(req);

    const templateId = getTemplateIdFromBody(req);
    if (!templateId) {
      next();
      return;
    }

    const template = await prisma.template.findUnique({
      where: { id: templateId },
      select: { id: true, isPremium: true, type: true },
    });

    if (!template || !template.isPremium) {
      next();
      return;
    }

    const plan = getUserPlan(req);
    const allowed =
      template.type === "application_letter"
        ? plan.canUsePremiumApplicationLetterTemplates
        : plan.canUsePremiumCvTemplates;

    if (!allowed) {
      throw new ResponseError(
        403,
        "Template ini khusus untuk pengguna Pro atau Max",
        undefined,
        { code: "PREMIUM_TEMPLATE_REQUIRED" }
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const checkStorageLimit = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = getAuthenticatedUser(req);

    const files: Express.Multer.File[] = [];
    if (req.file) {
      files.push(req.file);
    }
    if (req.files && !Array.isArray(req.files)) {
      const grouped = req.files as Record<string, Express.Multer.File[]>;
      for (const key of Object.keys(grouped)) {
        if (Array.isArray(grouped[key])) {
          files.push(...grouped[key]);
        }
      }
    }

    const totalNewBytes = files.reduce((sum, f) => sum + f.size, 0);

    const [usage] = await Promise.all([
      prisma.document.aggregate({
        where: { userId: user.id },
        _sum: { size: true },
      }),
    ]);

    const plan = getUserPlan(req);
    const limit = plan.maxDocumentStorageBytes;
    const currentUsage = usage._sum.size ?? 0;

    if (currentUsage + totalNewBytes > limit) {
      const limitMb = Math.max(1, Math.floor(limit / (1024 * 1024)));
      throw new ResponseError(
        400,
        `Batas penyimpanan dokumen tercapai. Kuota Anda ${limitMb} MB.`,
        undefined,
        { code: "STORAGE_LIMIT_REACHED" }
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const checkAiImprovementAccess = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    getAuthenticatedUser(req);

    if (!env.ai.enabled) {
      throw new ResponseError(
        503,
        "Fitur perbaikan AI sedang dinonaktifkan",
        undefined,
        { code: "AI_DISABLED" }
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};
