import { NextFunction, Request, Response } from "express";
import { prisma } from "../config/prisma.config";
import { ensureAccountIsActive } from "../utils/account-status.util";
import { ResponseError } from "../utils/response-error.util";
import { toSafeUser } from "../utils/user.util";
import {
  assertSessionTokenIsCurrent,
  extractAuthToken,
  verifySessionToken,
} from "../utils/session-auth.util";

export const optionalAuthMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const auth = extractAuthToken(req);
  if (!auth) {
    next();
    return;
  }

  try {
    const decoded = verifySessionToken(auth.token);
    const userId = decoded.sub;
    if (!userId || typeof userId !== "string") {
      next();
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      next();
      return;
    }

    try {
      assertSessionTokenIsCurrent(decoded, user);
      ensureAccountIsActive(user);
    } catch {
      next();
      return;
    }

    req.user = toSafeUser(user);
    req.authToken = auth.token;
    req.authSource = auth.source;
    next();
  } catch (error) {
    if (error instanceof ResponseError) {
      next();
      return;
    }
    next(error);
  }
};

export default optionalAuthMiddleware;
