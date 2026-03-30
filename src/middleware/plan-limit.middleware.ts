import type { NextFunction, Request, Response } from "express";
import { prisma } from "../config/prisma.config";
import {
  canDuplicateByKind,
  getPlan,
  isUnlimitedLimit,
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
    if (isUnlimitedLimit(cvLimit)) {
      next();
      return;
    }

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
    if (isUnlimitedLimit(applicationLetterLimit)) {
      next();
      return;
    }

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
    if (isUnlimitedLimit(applicationLimit)) {
      next();
      return;
    }

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
        : template.type === "cv"
          ? plan.canUsePremiumCvTemplates
          : plan.canUsePremiumTemplates;

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

const buildDuplicateAccessChecker = (
  kind: Parameters<typeof canDuplicateByKind>[1]
) => (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    getAuthenticatedUser(req);
    const planId = resolvePlanId(getAuthenticatedUser(req).subscriptionPlan);
    if (!canDuplicateByKind(planId, kind)) {
      throw new ResponseError(
        403,
        "Fitur duplikasi khusus untuk pengguna Pro atau Max",
        undefined,
        { code: "DUPLICATE_ACCESS_DENIED" }
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const checkCvDuplicateAccess = buildDuplicateAccessChecker("cv");
export const checkApplicationDuplicateAccess =
  buildDuplicateAccessChecker("application");
export const checkApplicationLetterDuplicateAccess =
  buildDuplicateAccessChecker("application_letter");

export const checkDocumentAccess = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    getAuthenticatedUser(req);
    const plan = getUserPlan(req);
    if (!plan.canManageDocuments) {
      throw new ResponseError(
        403,
        "Fitur dokumen khusus untuk pengguna Pro atau Max",
        undefined,
        { code: "DOCUMENT_ACCESS_DENIED" }
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};
