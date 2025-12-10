import type { StringValue } from "ms";
import dotenv from "dotenv";

// Load environment variables once and expose strongly typed config.
dotenv.config();

const parsePort = (value?: string): number => {
  const fallback = 3000;
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const parseNumber = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeEncryption = (value?: string): "ssl" | "tls" | undefined => {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === "null" || normalized === "none") {
    return undefined;
  }

  if (normalized === "ssl" || normalized === "tls") {
    return normalized;
  }

  return undefined;
};

const removeTrailingSlash = (value: string): string => {
  return value.replace(/\/+$/, "");
};

const resolveOptional = (value?: string | null): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "null") {
    return undefined;
  }

  return trimmed;
};

const defaultJwtExpiry: StringValue = "1d";
const defaultResetExpiry: StringValue = "15m";

const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parsePort(process.env.PORT),
  logLevel: process.env.LOG_LEVEL ?? "info",
  logFile: process.env.LOG_FILE ?? "logs/app.log",
  jwtSecret: requireEnv("JWT_SECRET"),
  jwtExpiresIn:
    (process.env.JWT_EXPIRES_IN as StringValue | undefined) ?? defaultJwtExpiry,
  sessionCookieName: process.env.SESSION_COOKIE_NAME ?? "karirkit_session",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  passwordResetTokenExpiresIn:
    (process.env.PASSWORD_RESET_TOKEN_EXPIRES_IN as StringValue | undefined) ??
    defaultResetExpiry,
  passwordResetUrl: removeTrailingSlash(requireEnv("PASSWORD_RESET_URL")),
  mail: {
    driver: process.env.MAIL_MAILER ?? "smtp",
    host: process.env.MAIL_HOST ?? "localhost",
    port: parseNumber(process.env.MAIL_PORT, 587),
    username: process.env.MAIL_USERNAME ?? "",
    password: process.env.MAIL_PASSWORD ?? "",
    encryption: normalizeEncryption(process.env.MAIL_ENCRYPTION),
    fromAddress: process.env.MAIL_FROM_ADDRESS ?? "no-reply@karirkit.local",
    fromName: process.env.MAIL_FROM_NAME ?? "KarirKit",
  },
  redis: {
    host: process.env.REDIS_HOST ?? "127.0.0.1",
    port: parseNumber(process.env.REDIS_PORT, 6379),
    password: resolveOptional(process.env.REDIS_PASSWORD ?? undefined),
    username: resolveOptional(process.env.REDIS_USERNAME ?? undefined),
    db: parseNumber(process.env.REDIS_DB, 0),
  },
};

export default env;
