import request from "supertest";
import {
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
} from "./real-mode";
import { ResponseError } from "../../src/utils/response-error.util";
import { afterAll, afterEach, beforeAll, describe, expect, it, mock } from "bun:test";

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
  mock.module("../../src/middleware/system-guard.middleware", () => ({
    maintenanceModeMiddleware: (
      _req: any,
      _res: any,
      next: () => void,
    ): void => {
      if (process.env.MAINTENANCE_MODE === "true") {
        const bypassRoutes = ["/health", "/auth/login", "/auth/register"];
        const pathname = _req?.path || _req?.url || "";
        if (bypassRoutes.some((route) => pathname.startsWith(route))) {
          next();
          return;
        }
        next(new ResponseError(503, "System sedang dalam mode maintenance"));
        return;
      }
      next();
    },
  }));

  ({ default: app } = await import("../../src/index"));
});

describe("Maintenance mode from env", () => {
  const originalMaintenanceMode = process.env.MAINTENANCE_MODE;

  afterEach(() => {
    if (originalMaintenanceMode === undefined) {
      delete process.env.MAINTENANCE_MODE;
    } else {
      process.env.MAINTENANCE_MODE = originalMaintenanceMode;
    }
  });

  afterAll(async () => {
    if (process.env.RUN_REAL_API_TESTS === "true") {
      await disconnectPrisma();
    }
  });

  it("blocks non-bypass routes when MAINTENANCE_MODE=true", async () => {
    process.env.MAINTENANCE_MODE = "true";

    const response = await request(app).get("/dashboard");

    expect(response.status).toBe(503);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toContain("maintenance");
  });

  it("still allows bypass routes when MAINTENANCE_MODE=true", async () => {
    process.env.MAINTENANCE_MODE = "true";

    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
  });

  it("allows authenticated admins to bootstrap during maintenance", async () => {
    if (process.env.RUN_REAL_API_TESTS !== "true") {
      return;
    }

    process.env.MAINTENANCE_MODE = "true";
    const trackedEmails = new Set<string>();

    try {
      const { user } = await createRealUser("maintenance-env-admin", {
        role: "admin",
      });
      trackedEmails.add(user.email);
      const token = await createSessionToken(user);

      const response = await request(app)
        .get("/account/me")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("data.id", user.id);
      expect(response.body.data.role).toBe("admin");
    } finally {
      await deleteUsersByEmail(...trackedEmails);
    }
  });
});
