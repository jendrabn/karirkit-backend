import { NextFunction, Request, Response } from "express";
import jwt, { JsonWebTokenError, JwtPayload } from "jsonwebtoken";
import env from "../config/env.config";
import { prisma } from "../config/prisma.config";
import { ensureAccountIsActive } from "../utils/account-status.util";
import { toSafeUser } from "../utils/user.util";

const extractToken = (req: Request): string | null => {
  const cookieToken = req.cookies?.[env.sessionCookieName];
  if (typeof cookieToken === "string" && cookieToken.trim().length > 0) {
    return cookieToken;
  }

  const authHeader = req.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    return token.length > 0 ? token : null;
  }

  return null;
};

export const optionalAuthMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const token = extractToken(req);
  if (!token) {
    next();
    return;
  }

  try {
    const decoded = jwt.verify(token, env.jwtSecret) as JwtPayload;
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
      ensureAccountIsActive(user);
    } catch {
      next();
      return;
    }

    req.user = toSafeUser(user);
    req.authToken = token;
    next();
  } catch (error) {
    if (error instanceof JsonWebTokenError) {
      next();
      return;
    }
    next(error);
  }
};

export default optionalAuthMiddleware;
