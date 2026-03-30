process.env.NODE_ENV = "test";
process.env.JWT_SECRET ||= "test-secret";
process.env.PASSWORD_RESET_URL ||= "http://localhost:3000/reset-password";
process.env.APP_BASE_URL ||= "http://localhost:3000";
process.env.CORS_ORIGINS ||= "http://localhost:3000";
process.env.MAINTENANCE_MODE ||= "false";

const buildMockUser = (overrides: Record<string, unknown> = {}) => ({
  id: "user-1",
  role: "user",
  email: "user@example.com",
  username: "user",
  subscriptionPlan: "free",
  subscriptionExpiresAt: null,
  ...overrides,
});

const buildMockAdmin = (overrides: Record<string, unknown> = {}) => ({
  id: "admin-1",
  role: "admin",
  email: "admin@example.com",
  username: "admin",
  subscriptionPlan: "max",
  subscriptionExpiresAt: null,
  ...overrides,
});

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

jest.mock("../../src/middleware/system-guard.middleware", () => {
  return {
    __esModule: true,
    maintenanceModeMiddleware: (
      _req: unknown,
      _res: unknown,
      next: () => void,
    ): void => {
      next();
    },
  };
});

jest.mock("../../src/middleware/auth.middleware", () => {
  const { ResponseError } = require("../../src/utils/response-error.util");

  return {
    __esModule: true,
    default: (req: any, _res: unknown, next: (error?: unknown) => void): void => {
      const header = req.get?.("authorization");

      if (header === "Bearer user-token") {
        req.user = buildMockUser();
        req.authToken = "user-token";
        next();
        return;
      }

      if (header === "Bearer pro-token") {
        req.user = buildMockUser({
          subscriptionPlan: "pro",
          subscriptionExpiresAt: new Date("2030-01-01T00:00:00.000Z"),
        });
        req.authToken = "pro-token";
        next();
        return;
      }

      if (header === "Bearer admin-token") {
        req.user = buildMockAdmin();
        req.authToken = "admin-token";
        next();
        return;
      }

      if (header === "Bearer admin-pro-token") {
        req.user = buildMockAdmin({
          subscriptionPlan: "pro",
          subscriptionExpiresAt: new Date("2030-01-01T00:00:00.000Z"),
        });
        req.authToken = "admin-pro-token";
        next();
        return;
      }

      if (header === "Bearer admin-free-token") {
        req.user = buildMockAdmin({
          subscriptionPlan: "free",
        });
        req.authToken = "admin-free-token";
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
        req.user = buildMockUser();
        req.authToken = "user-token";
      }

      if (header === "Bearer pro-token") {
        req.user = buildMockUser({
          subscriptionPlan: "pro",
          subscriptionExpiresAt: new Date("2030-01-01T00:00:00.000Z"),
        });
        req.authToken = "pro-token";
      }

      if (header === "Bearer admin-token") {
        req.user = buildMockAdmin();
        req.authToken = "admin-token";
      }

      if (header === "Bearer admin-pro-token") {
        req.user = buildMockAdmin({
          subscriptionPlan: "pro",
          subscriptionExpiresAt: new Date("2030-01-01T00:00:00.000Z"),
        });
        req.authToken = "admin-pro-token";
      }

      if (header === "Bearer admin-free-token") {
        req.user = buildMockAdmin({
          subscriptionPlan: "free",
        });
        req.authToken = "admin-free-token";
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
