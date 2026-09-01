import request from "supertest";
import { beforeAll, describe, expect, it, mock } from "bun:test";

let app: typeof import("../../src/index").default;

beforeAll(async () => {
  mock.module("../../src/middleware/auth.middleware", () => ({
    authMiddleware: (_req: any, _res: unknown, next: () => void) => next(),
    default: (_req: any, _res: unknown, next: () => void) => next(),
  }));
  mock.module("../../src/middleware/rate-limit.middleware", () => ({
    globalRateLimiter: (_req: any, _res: unknown, next: () => void) => next(),
    loginRateLimiter: (_req: any, _res: unknown, next: () => void) => next(),
    passwordResetRateLimiter: (_req: any, _res: unknown, next: () => void) => next(),
  }));
  mock.module("../../src/controllers/health.controller", () => ({
    getHealth: () => {
      throw new Error("database credentials leaked");
    },
  }));

  ({ default: app } = await import("../../src/index"));
});

describe("Unhandled error responses", () => {
  it("does not expose internal server error messages", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(500);
    expect(response.body.errors.general[0]).toBe("Internal Server Error");
    expect(JSON.stringify(response.body)).not.toContain("database credentials leaked");
  });
});
