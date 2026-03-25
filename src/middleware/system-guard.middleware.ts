import { NextFunction, Request, Response } from "express";
import env from "../config/env.config";
import { prisma } from "../config/prisma.config";
import { ensureAccountIsActive } from "../utils/account-status.util";
import { ResponseError } from "../utils/response-error.util";
import {
  assertSessionTokenIsCurrent,
  extractAuthToken,
  verifySessionToken,
} from "../utils/session-auth.util";

const isMaintenanceBypassPath = (path: string): boolean => {
  return (
    path === "/health" ||
    path.startsWith("/docs") ||
    path.startsWith("/auth/") ||
    path.startsWith("/admin/")
  );
};

const isAuthenticatedAdminRequest = async (req: Request): Promise<boolean> => {
  const auth = extractAuthToken(req);
  if (!auth) {
    return false;
  }

  try {
    const decoded = verifySessionToken(auth.token);
    const userId = decoded.sub;
    if (!userId || typeof userId !== "string") {
      return false;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        status: true,
        statusReason: true,
        suspendedUntil: true,
        sessionInvalidBefore: true,
      },
    });

    if (!user) {
      return false;
    }

    assertSessionTokenIsCurrent(decoded, user);
    ensureAccountIsActive(user);

    return user.role === "admin";
  } catch {
    return false;
  }
};

export const maintenanceModeMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (req.method === "OPTIONS" || isMaintenanceBypassPath(req.path)) {
      next();
      return;
    }

    if (!env.maintenanceMode) {
      next();
      return;
    }

    if (await isAuthenticatedAdminRequest(req)) {
      next();
      return;
    }

    next(
      new ResponseError(
        503,
        "Sistem sedang dalam maintenance. Silakan coba lagi beberapa saat."
      )
    );
  } catch (error) {
    next(error as Error);
  }
};
