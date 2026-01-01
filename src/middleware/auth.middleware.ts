import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import env from "../config/env.config";
import { prisma } from "../config/prisma.config";
import { ensureAccountIsActive } from "../utils/account-status.util";
import { toSafeUser } from "../utils/user.util";
import { ResponseError } from "../utils/response-error.util";

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

export const authMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);

    if (!token) {
      throw new ResponseError(401, "Unauthenticated");
    }

    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, env.jwtSecret) as JwtPayload;
    } catch {
      throw new ResponseError(401, "Invalid or expired session");
    }

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

    ensureAccountIsActive(user);

    req.user = toSafeUser(user);
    req.authToken = token;

    next();
  } catch (error) {
    next(error);
  }
};

export default authMiddleware;
