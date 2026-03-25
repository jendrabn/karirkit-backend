import type { CookieOptions, Request } from "express";
import type { User } from "../generated/prisma/client";
import jwt, { JwtPayload } from "jsonwebtoken";
import env from "../config/env.config";
import { ResponseError } from "./response-error.util";

export type AuthTokenSource = "bearer" | "cookie";

type SessionPrincipal = Pick<User, "id" | "username" | "email">;
type SessionState = Pick<User, "sessionInvalidBefore">;

export const extractAuthToken = (
  req: Request
): { token: string; source: AuthTokenSource } | null => {
  const authHeader = req.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token.length > 0) {
      return { token, source: "bearer" };
    }
  }

  const cookieToken = req.cookies?.[env.sessionCookieName];
  if (typeof cookieToken === "string" && cookieToken.trim().length > 0) {
    return { token: cookieToken, source: "cookie" };
  }

  return null;
};

export const createSessionToken = (
  user: SessionPrincipal
): { token: string; expires_at?: number } => {
  const sessionIssuedAtMs = Date.now();
  const token = jwt.sign(
    {
      sub: user.id,
      username: user.username,
      email: user.email,
      session_iat_ms: sessionIssuedAtMs,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );

  const decoded = jwt.decode(token) as JwtPayload | null;

  return {
    token,
    expires_at: decoded?.exp ? decoded.exp * 1000 : undefined,
  };
};

export const verifySessionToken = (token: string): JwtPayload => {
  try {
    return jwt.verify(token, env.jwtSecret) as JwtPayload;
  } catch {
    throw new ResponseError(401, "Invalid or expired session");
  }
};

export const assertSessionTokenIsCurrent = (
  decoded: JwtPayload,
  user: SessionState
): void => {
  if (!user.sessionInvalidBefore) {
    return;
  }

  const sessionIssuedAtMs =
    typeof decoded.session_iat_ms === "number"
      ? decoded.session_iat_ms
      : typeof decoded.iat === "number"
      ? decoded.iat * 1000
      : null;

  if (sessionIssuedAtMs === null) {
    throw new ResponseError(401, "Invalid or expired session");
  }

  if (sessionIssuedAtMs < user.sessionInvalidBefore.getTime()) {
    throw new ResponseError(401, "Invalid or expired session");
  }
};

const buildBaseSessionCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: env.nodeEnv === "production",
  sameSite: env.nodeEnv === "production" ? "none" : "lax",
});

export const buildSessionCookieOptions = (
  expiresAt?: number
): CookieOptions => {
  const maxAge =
    typeof expiresAt === "number"
      ? Math.max(expiresAt - Date.now(), 0)
      : 24 * 60 * 60 * 1000;

  return {
    ...buildBaseSessionCookieOptions(),
    maxAge,
  };
};

export const buildSessionClearCookieOptions = (): CookieOptions => {
  return buildBaseSessionCookieOptions();
};
