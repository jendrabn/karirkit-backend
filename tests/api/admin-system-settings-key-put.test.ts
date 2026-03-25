import request from "supertest";
import {
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
  loadPrisma,
} from "./real-mode";

let app: typeof import("../../src/index").default;
let SystemSettingService: typeof import("../../src/services/system-setting.service").SystemSettingService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/system-setting.service", () => {
      const actual = jest.requireActual("../../src/services/system-setting.service");
      return {
        ...actual,
        SystemSettingService: {
          ...actual.SystemSettingService,
          isMaintenanceEnabled: jest.fn().mockResolvedValue(false),
          isReadOnlyEnabled: jest.fn().mockResolvedValue(false),
          update: jest.fn(),
        },
      };
    });
  }

  ({ default: app } = await import("../../src/index"));
  ({ SystemSettingService } = await import(
    "../../src/services/system-setting.service"
  ));
  ({ ResponseError: ResponseErrorClass } = await import(
    "../../src/utils/response-error.util"
  ));
});

afterAll(async () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    await disconnectPrisma();
  }
});

describe("PUT /admin/system-settings/:key", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("updates a system setting", async () => {
    const updateMock = jest.mocked(SystemSettingService.update);
    updateMock.mockResolvedValue({
      key: "auth.registration.enabled",
      group: "auth",
      type: "boolean",
      value: false,
    } as never);

    const response = await request(app)
      .put("/admin/system-settings/auth.registration.enabled")
      .set("Authorization", "Bearer admin-token")
      .send({ value: false });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      key: "auth.registration.enabled",
      group: "auth",
      type: "boolean",
      value: false,
    });
  });

  it("returns 403 for non-admin users", async () => {
    const response = await request(app)
      .put("/admin/system-settings/auth.registration.enabled")
      .set("Authorization", "Bearer user-token")
      .send({ value: false });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns validation errors for invalid values", async () => {
    const updateMock = jest.mocked(SystemSettingService.update);
    updateMock.mockRejectedValue(
      new ResponseErrorClass(400, "Nilai harus berupa boolean")
    );

    const response = await request(app)
      .put("/admin/system-settings/auth.registration.enabled")
      .set("Authorization", "Bearer admin-token")
      .send({ value: "nope" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Nilai harus berupa boolean");
  });
});

describe("PUT /admin/system-settings/:key", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }

  const trackedEmails = new Set<string>();
  const trackedKeys = ["auth.registration.enabled"];

  afterEach(async () => {
    const prisma = await loadPrisma();
    await prisma.systemSetting.deleteMany({
      where: { key: { in: trackedKeys } },
    });
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("updates a system setting", async () => {
    const prisma = await loadPrisma();
    const { user: admin } = await createRealUser("system-setting-update", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .put("/admin/system-settings/auth.registration.enabled")
      .set("Authorization", `Bearer ${token}`)
      .send({ value: false });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      key: "auth.registration.enabled",
      value: false,
      source: "database",
    });

    const stored = await prisma.systemSetting.findUnique({
      where: { key: "auth.registration.enabled" },
    });
    expect(stored?.valueJson).toBe(false);
  });

  it("returns 403 for non-admin users", async () => {
    const { user } = await createRealUser("system-setting-update-forbidden");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .put("/admin/system-settings/auth.registration.enabled")
      .set("Authorization", `Bearer ${token}`)
      .send({ value: false });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns validation errors for invalid values", async () => {
    const { user: admin } = await createRealUser("system-setting-update-invalid", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .put("/admin/system-settings/auth.registration.enabled")
      .set("Authorization", `Bearer ${token}`)
      .send({ value: "wrong-type" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Nilai harus berupa boolean");
  });
});
