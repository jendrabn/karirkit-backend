import { mock } from "bun:test";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET ||= "test-secret";
process.env.PASSWORD_RESET_URL ||= "http://localhost:3000/reset-password";
process.env.APP_BASE_URL ||= "http://localhost:3000";
process.env.CORS_ORIGINS ||= "http://localhost:3000";
process.env.MAINTENANCE_MODE ||= "false";

if (process.env.RUN_REAL_API_TESTS === "true") {
  process.env.OTP_ENABLED = "false";

  if (process.env.TEST_DATABASE_HOST) {
    process.env.DATABASE_HOST = process.env.TEST_DATABASE_HOST;
  }
  if (process.env.TEST_DATABASE_USER) {
    process.env.DATABASE_USER = process.env.TEST_DATABASE_USER;
  }
  if (process.env.TEST_DATABASE_PASSWORD !== undefined) {
    process.env.DATABASE_PASSWORD = process.env.TEST_DATABASE_PASSWORD;
  }
  if (process.env.TEST_DATABASE_NAME) {
    process.env.DATABASE_NAME = process.env.TEST_DATABASE_NAME;
  }
}

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

mock.module("../../src/middleware/logger.middleware", () => {
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
    default: requestLogger,
    errorLogger,
    appLogger: {
      info: mock(() => {}),
      warn: mock(() => {}),
      error: mock(() => {}),
    },
  };
});

if (process.env.RUN_REAL_API_TESTS !== "true") {
  mock.module("../../src/middleware/rate-limit.middleware", () => {
    const noop = (_req: unknown, _res: unknown, next: () => void): void => {
      next();
    };

    return {
      globalRateLimiter: noop,
      loginRateLimiter: noop,
      passwordResetRateLimiter: noop,
    };
  });

  mock.module("../../src/middleware/system-guard.middleware", () => {
    return {
      maintenanceModeMiddleware: (
        _req: unknown,
        _res: unknown,
        next: () => void,
      ): void => {
        next();
      },
    };
  });

  mock.module("../../src/middleware/auth.middleware", () => {
    return {
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

        const { ResponseError } = require("../../src/utils/response-error.util");
        next(new ResponseError(401, "Unauthenticated"));
      },
    };
  });

  mock.module("../../src/middleware/admin.middleware", () => {
    return {
      default: (req: any, _res: unknown, next: (error?: unknown) => void): void => {
        if (!req.user) {
          const { ResponseError } = require("../../src/utils/response-error.util");
          next(new ResponseError(401, "Unauthenticated"));
          return;
        }

        if (req.user.role !== "admin") {
          const { ResponseError } = require("../../src/utils/response-error.util");
          next(new ResponseError(403, "Admin access required"));
          return;
        }

        next();
      },
    };
  });

  mock.module("../../src/middleware/optional-auth.middleware", () => {
    return {
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
}

mock.module("../../src/queues/email.queue", () => ({
  enqueueEmail: mock(() => {}),
  default: {
    on: mock(() => {}),
    process: mock(() => {}),
    add: mock(() => {}),
  },
}));
