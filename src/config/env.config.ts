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

const parseDurationSeconds = (
  value: string | undefined,
  fallback: number
): number => {
  if (!value) {
    return fallback;
  }

  const trimmed = value.trim().toLowerCase();
  const numeric = Number(trimmed);
  if (Number.isFinite(numeric)) {
    return Math.max(0, Math.ceil(numeric));
  }

  const match = trimmed.match(/^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/);
  if (!match) {
    return fallback;
  }

  const amount = Number(match[1]);
  const unit = match[2];
  if (!Number.isFinite(amount)) {
    return fallback;
  }

  const multiplier =
    unit === "ms"
      ? 1 / 1000
      : unit === "s"
        ? 1
        : unit === "m"
          ? 60
          : unit === "h"
            ? 3600
            : 86400;

  return Math.max(0, Math.ceil(amount * multiplier));
};

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }

  return fallback;
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
  maintenanceMode: parseBoolean(process.env.MAINTENANCE_MODE, false),
  appBaseUrl: removeTrailingSlash(
    process.env.APP_BASE_URL ?? "http://localhost:3000"
  ),
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:3000",
  corsOrigins: process.env.CORS_ORIGINS?.split(",").map((origin) =>
    origin.trim()
  ) || ["http://localhost:3000"],
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
  otp: {
    enabled: parseBoolean(process.env.OTP_ENABLED, false),
    expiresInSeconds: parseDurationSeconds(process.env.OTP_EXPIRES_IN, 300), // 5 minutes default
    resendCooldownInSeconds: parseDurationSeconds(process.env.OTP_RESEND_COOLDOWN, 60), // 1 minute default
  },
  documentStorageLimitMaxBytes: parseNumber(
    process.env.DOCUMENT_STORAGE_LIMIT_MAX_BYTES,
    1024 * 1024 * 1024
  ),
  ghostscriptCommand: process.env.GHOSTSCRIPT_COMMAND ?? "gs",
  pdfCompressionEnabled: process.env.PDF_COMPRESSION_ENABLED === "true",
  ghostscriptPdfSettings:
    process.env.GHOSTSCRIPT_PDFSETTINGS ?? "/screen",
  ghostscriptColorResolution: parseNumber(
    process.env.GHOSTSCRIPT_COLOR_RESOLUTION,
    96
  ),
  ghostscriptJpegQuality: parseNumber(
    process.env.GHOSTSCRIPT_JPEG_QUALITY,
    60
  ),
  libreOfficeCommand: process.env.LIBREOFFICE_COMMAND ?? "soffice",
  pdfDownloadEnabled: parseBoolean(process.env.PDF_DOWNLOAD_ENABLED, true),
  midtrans: {
    serverKey: resolveOptional(process.env.MIDTRANS_SERVER_KEY) ?? "",
    clientKey: resolveOptional(process.env.MIDTRANS_CLIENT_KEY) ?? "",
    isProduction: parseBoolean(process.env.MIDTRANS_IS_PRODUCTION, false),
    notificationUrl: resolveOptional(
      process.env.MIDTRANS_NOTIFICATION_URL ?? undefined
    ),
  },
  storage: {
    driver:
      process.env.STORAGE_DRIVER?.trim().toLowerCase() === "s3"
        ? "s3"
        : "local",
    bucket: resolveOptional(process.env.STORAGE_BUCKET ?? undefined) ?? "",
    region: resolveOptional(process.env.STORAGE_REGION ?? undefined) ?? "auto",
    endpoint: resolveOptional(process.env.STORAGE_ENDPOINT ?? undefined),
    accessKeyId:
      resolveOptional(process.env.STORAGE_ACCESS_KEY_ID ?? undefined) ?? "",
    secretAccessKey:
      resolveOptional(process.env.STORAGE_SECRET_ACCESS_KEY ?? undefined) ?? "",
    forcePathStyle: parseBoolean(process.env.STORAGE_FORCE_PATH_STYLE, false),
  },
};

export default env;
