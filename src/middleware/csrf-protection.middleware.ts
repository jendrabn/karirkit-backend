import type { NextFunction, Request, Response } from "express";
import env from "../config/env.config";
import { ResponseError } from "../utils/response-error.util";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const normalizeOrigin = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

const getTrustedOrigins = (): Set<string> => {
  const trustedOrigins = new Set<string>();

  for (const origin of env.corsOrigins) {
    const normalized = normalizeOrigin(origin);
    if (normalized) {
      trustedOrigins.add(normalized);
    }
  }

  const frontendOrigin = normalizeOrigin(env.frontendUrl);
  if (frontendOrigin) {
    trustedOrigins.add(frontendOrigin);
  }

  const appOrigin = normalizeOrigin(env.appBaseUrl);
  if (appOrigin) {
    trustedOrigins.add(appOrigin);
  }

  return trustedOrigins;
};

export const csrfProtectionMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    if (SAFE_METHODS.has(req.method.toUpperCase())) {
      next();
      return;
    }

    const authHeader = req.get("authorization");
    if (authHeader?.toLowerCase().startsWith("bearer ")) {
      next();
      return;
    }

    const cookieToken = req.cookies?.[env.sessionCookieName];
    if (typeof cookieToken !== "string" || cookieToken.trim().length === 0) {
      next();
      return;
    }

    const requestOrigin =
      normalizeOrigin(req.get("origin")) ?? normalizeOrigin(req.get("referer"));
    const trustedOrigins = getTrustedOrigins();

    if (!requestOrigin || !trustedOrigins.has(requestOrigin)) {
      throw new ResponseError(
        403,
        "Permintaan lintas-origin tidak diizinkan untuk sesi berbasis cookie"
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

export default csrfProtectionMiddleware;
