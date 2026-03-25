process.env.NODE_ENV = "test";
process.env.JWT_SECRET ||= "test-secret";
process.env.PASSWORD_RESET_URL ||= "http://localhost:3000/reset-password";
process.env.APP_BASE_URL ||= "http://localhost:3000";
process.env.CORS_ORIGINS ||= "http://localhost:3000";
process.env.MAINTENANCE_MODE ||= "false";

jest.mock("../../src/middleware/logger.middleware", () => {
  const requestLogger = (
    _req: unknown,
    _res: unknown,
    next: () => void,
  ): void => {
    next();
  };
  const errorLogger = (
    err: unknown,
    _req: unknown,
    _res: unknown,
    next: (error?: unknown) => void,
  ): void => {
    next(err);
  };

  return {
    __esModule: true,
    default: requestLogger,
    errorLogger,
    appLogger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
  };
});

jest.mock("../../src/middleware/rate-limit.middleware", () => {
  const noop = (_req: unknown, _res: unknown, next: () => void): void => {
    next();
  };

  return {
    __esModule: true,
    globalRateLimiter: noop,
    loginRateLimiter: noop,
    passwordResetRateLimiter: noop,
  };
});

jest.mock("../../src/middleware/auth.middleware", () => {
  const { ResponseError } = require("../../src/utils/response-error.util");

  return {
    __esModule: true,
    default: (req: any, _res: unknown, next: (error?: unknown) => void): void => {
      const header = req.get?.("authorization");

      if (header === "Bearer user-token") {
        req.user = {
          id: "user-1",
          role: "user",
          email: "user@example.com",
          username: "user",
        };
        req.authToken = "user-token";
        next();
        return;
      }

      if (header === "Bearer admin-token") {
        req.user = {
          id: "admin-1",
          role: "admin",
          email: "admin@example.com",
          username: "admin",
        };
        req.authToken = "admin-token";
        next();
        return;
      }

      next(new ResponseError(401, "Unauthenticated"));
    },
  };
});

jest.mock("../../src/middleware/admin.middleware", () => {
  const { ResponseError } = require("../../src/utils/response-error.util");

  return {
    __esModule: true,
    default: (req: any, _res: unknown, next: (error?: unknown) => void): void => {
      if (!req.user) {
        next(new ResponseError(401, "Unauthenticated"));
        return;
      }

      if (req.user.role !== "admin") {
        next(new ResponseError(403, "Admin access required"));
        return;
      }

      next();
    },
  };
});

jest.mock("../../src/middleware/optional-auth.middleware", () => {
  return {
    __esModule: true,
    default: (req: any, _res: unknown, next: () => void): void => {
      const header = req.get?.("authorization");

      if (header === "Bearer user-token") {
        req.user = {
          id: "user-1",
          role: "user",
          email: "user@example.com",
          username: "user",
        };
        req.authToken = "user-token";
      }

      if (header === "Bearer admin-token") {
        req.user = {
          id: "admin-1",
          role: "admin",
          email: "admin@example.com",
          username: "admin",
        };
        req.authToken = "admin-token";
      }

      next();
    },
  };
});

jest.mock("../../src/queues/email.queue", () => ({
  __esModule: true,
  enqueueEmail: jest.fn(),
  default: {
    on: jest.fn(),
    process: jest.fn(),
    add: jest.fn(),
  },
}));

jest.mock("../../src/services/system-setting.service", () => ({
  __esModule: true,
  SystemSettingService: {
    isRegistrationEnabled: jest.fn().mockResolvedValue(true),
    isGoogleLoginEnabled: jest.fn().mockResolvedValue(true),
    isPasswordResetEnabled: jest.fn().mockResolvedValue(true),
    isOtpEnabled: jest.fn().mockResolvedValue(false),
    getOtpExpiresInSeconds: jest.fn().mockResolvedValue(300),
    getOtpResendCooldownSeconds: jest.fn().mockResolvedValue(60),
    getDefaultDailyDownloadLimit: jest.fn().mockResolvedValue(10),
    getDefaultDocumentStorageLimit: jest
      .fn()
      .mockResolvedValue(100 * 1024 * 1024),
    getTempUploadConfig: jest.fn().mockResolvedValue({
      enabled: true,
      maxSizeBytes: 10 * 1024 * 1024,
    }),
    getBlogUploadConfig: jest.fn().mockResolvedValue({
      enabled: true,
      maxSizeBytes: 5 * 1024 * 1024,
    }),
    getDocumentUploadConfig: jest.fn().mockResolvedValue({
      enabled: true,
      maxSizeBytes: 25 * 1024 * 1024,
      maxFileCount: 20,
    }),
    assertDownloadsEnabled: jest.fn().mockResolvedValue(undefined),
    getBoolean: jest.fn().mockResolvedValue(true),
    getNumber: jest.fn().mockResolvedValue(1),
    list: jest.fn(),
    bulkUpdate: jest.fn(),
    clearCache: jest.fn(),
  },
}));
