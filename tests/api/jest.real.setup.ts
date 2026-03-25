process.env.NODE_ENV = "test";
process.env.JWT_SECRET ||= "test-secret";
process.env.PASSWORD_RESET_URL ||= "http://localhost:3000/reset-password";
process.env.APP_BASE_URL ||= "http://localhost:3000";
process.env.CORS_ORIGINS ||= "http://localhost:3000";
process.env.MAINTENANCE_MODE ||= "false";
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

jest.mock("../../src/queues/email.queue", () => ({
  __esModule: true,
  enqueueEmail: jest.fn(),
  default: {
    on: jest.fn(),
    process: jest.fn(),
    add: jest.fn(),
  },
}));
