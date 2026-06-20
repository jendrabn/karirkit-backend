import type { NextFunction, Request, Response } from "express";
import env from "../config/env.config";
import { prisma } from "../config/prisma.config";
import {
  getPlan,
  resolvePlanId,
} from "../config/subscription-plans.config";
import { ResponseError } from "../utils/response-error.util";

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
