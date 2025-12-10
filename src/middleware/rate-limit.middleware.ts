import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { Request, Response, NextFunction } from "express";
import { sendError } from "../utils/response-builder.util";

const getRetrySeconds = (req: Request, windowMs: number): number => {
  const resetTime =
    req.rateLimit?.resetTime?.getTime() ?? Date.now() + windowMs;
  const diff = Math.max(resetTime - Date.now(), 0);
  return Math.max(Math.ceil(diff / 1000), 1);
};

const buildHandler =
  (windowMs: number, baseMessage: string) =>
  (req: Request, res: Response, _next: NextFunction): void => {
    const waitSeconds = getRetrySeconds(req, windowMs);
    sendError(res, `${baseMessage}, try again in ${waitSeconds} seconds`, 429);
  };

export const globalRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === "OPTIONS", // Skip rate limit for preflight requests
  handler: buildHandler(60_000, "Too many requests from this IP"),
});

export const loginRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 3,
  standardHeaders: false,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const identifier =
      typeof req.body?.identifier === "string"
        ? req.body.identifier.toLowerCase()
        : undefined;
    return identifier ?? ipKeyGenerator(req.ip ?? "");
  },
  handler: buildHandler(60_000, "Too many login attempts"),
});

export const passwordResetRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 3,
  standardHeaders: false,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email =
      typeof req.body?.email === "string"
        ? req.body.email.toLowerCase()
        : undefined;
    return email ?? ipKeyGenerator(req.ip ?? "");
  },
  handler: buildHandler(15 * 60 * 1000, "Too many password reset attempts"),
});
