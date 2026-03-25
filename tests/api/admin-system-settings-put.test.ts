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
          bulkUpdate: jest.fn(),
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

describe("PUT /admin/system-settings", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("updates multiple system settings in one request", async () => {
    const bulkUpdateMock = jest.mocked(SystemSettingService.bulkUpdate);
    bulkUpdateMock.mockResolvedValue({
      items: [
        {
          key: "auth.registration.enabled",
          group: "auth",
          type: "boolean",
          value: false,
        },
        {
          key: "auth.otp.expires_in_seconds",
          group: "auth",
          type: "number",
          value: 180,
        },
      ],
    } as never);

    const response = await request(app)
      .put("/admin/system-settings")
      .set("Authorization", "Bearer admin-token")
      .send({
        auth: {
          registration: {
            enabled: false,
          },
          otp: {
            expires_in_seconds: 180,
          },
        },
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "auth.registration.enabled",
          value: false,
        }),
        expect.objectContaining({
          key: "auth.otp.expires_in_seconds",
          value: 180,
        }),
      ])
    );
  });

  it("returns 403 for non-admin users", async () => {
    const response = await request(app)
      .put("/admin/system-settings")
      .set("Authorization", "Bearer user-token")
      .send({
        auth: {
          registration: {
            enabled: false,
          },
        },
      });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns validation errors for invalid values", async () => {
    const bulkUpdateMock = jest.mocked(SystemSettingService.bulkUpdate);
    bulkUpdateMock.mockRejectedValue(
      new ResponseErrorClass(400, "Nilai harus berupa boolean")
    );

    const response = await request(app)
      .put("/admin/system-settings")
      .set("Authorization", "Bearer admin-token")
      .send({
        auth: {
          registration: {
            enabled: "nope",
          },
        },
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Nilai harus berupa boolean");
  });
});

describe("PUT /admin/system-settings", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }

  const trackedEmails = new Set<string>();
  const trackedKeys = [
    "auth.registration.enabled",
    "auth.otp.expires_in_seconds",
  ];

  afterEach(async () => {
    const prisma = await loadPrisma();
    await prisma.systemSetting.deleteMany({
      where: { key: { in: trackedKeys } },
    });
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("updates multiple system settings in one request", async () => {
    const prisma = await loadPrisma();
    const { user: admin } = await createRealUser("system-settings-bulk-update", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .put("/admin/system-settings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        auth: {
          registration: {
            enabled: false,
          },
          otp: {
            expires_in_seconds: 180,
          },
        },
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "auth.registration.enabled",
          value: false,
          source: "database",
        }),
        expect.objectContaining({
          key: "auth.otp.expires_in_seconds",
          value: 180,
          source: "database",
        }),
      ])
    );

    const stored = await prisma.systemSetting.findMany({
      where: { key: { in: trackedKeys } },
    });
    expect(stored).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "auth.registration.enabled",
          valueJson: false,
        }),
        expect.objectContaining({
          key: "auth.otp.expires_in_seconds",
          valueJson: 180,
        }),
      ])
    );
  });

  it("returns 403 for non-admin users", async () => {
    const { user } = await createRealUser("system-settings-bulk-update-forbidden");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .put("/admin/system-settings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        auth: {
          registration: {
            enabled: false,
          },
        },
      });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns validation errors for unknown payload keys", async () => {
    const { user: admin } = await createRealUser(
      "system-settings-bulk-update-invalid",
      {
        role: "admin",
      }
    );
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .put("/admin/system-settings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        auth: {
          registration: {
            invalid_key: false,
          },
        },
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe(
      "Pengaturan sistem tidak dikenal: auth.registration.invalid_key"
    );
  });
});
