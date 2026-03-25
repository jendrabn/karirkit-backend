import { NextFunction, Request, Response } from "express";
import { prisma } from "../config/prisma.config";
import { ensureAccountIsActive } from "../utils/account-status.util";
import { toSafeUser } from "../utils/user.util";
import { ResponseError } from "../utils/response-error.util";
import {
  assertSessionTokenIsCurrent,
  extractAuthToken,
  verifySessionToken,
} from "../utils/session-auth.util";

export const authMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const auth = extractAuthToken(req);
    if (!auth) {
      throw new ResponseError(401, "Unauthenticated");
    }

    const decoded = verifySessionToken(auth.token);

    const userId = decoded.sub;
    if (!userId || typeof userId !== "string") {
      throw new ResponseError(401, "Unauthenticated");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new ResponseError(401, "Unauthenticated");
    }

    assertSessionTokenIsCurrent(decoded, user);
    ensureAccountIsActive(user);

    req.user = toSafeUser(user);
    req.authToken = auth.token;
    req.authSource = auth.source;

    next();
  } catch (error) {
    next(error);
  }
};

export default authMiddleware;
