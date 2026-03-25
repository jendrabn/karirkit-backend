import request from "supertest";
import {
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
} from "./real-mode";

jest.setTimeout(20_000);

const importAppFresh = async () => {
  jest.resetModules();
  const module = await import("../../src/index");
  return module.default;
};

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
    const app = await importAppFresh();

    const response = await request(app).get("/dashboard");

    expect(response.status).toBe(503);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toContain("maintenance");
  });

  it("still allows bypass routes when MAINTENANCE_MODE=true", async () => {
    process.env.MAINTENANCE_MODE = "true";
    const app = await importAppFresh();

    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
  });

  it("allows authenticated admins to bootstrap during maintenance", async () => {
    if (process.env.RUN_REAL_API_TESTS !== "true") {
      return;
    }

    process.env.MAINTENANCE_MODE = "true";
    const app = await importAppFresh();
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
