import request from "supertest";
import {
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
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
          list: jest.fn(),
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

describe("GET /admin/system-settings", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the available system setting list", async () => {
    const listMock = jest.mocked(SystemSettingService.list);
    listMock.mockResolvedValue({
      items: [
        {
          key: "auth.registration.enabled",
          group: "auth",
          type: "boolean",
          value: true,
          default_value: true,
          source: "default",
        },
      ],
    } as never);

    const response = await request(app)
      .get("/admin/system-settings?group=auth")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(Array.isArray(response.body.data.items)).toBe(true);
    expect(response.body.data.items[0]).toMatchObject({
      key: "auth.registration.enabled",
      group: "auth",
      type: "boolean",
      value: true,
    });
  });

  it("returns 403 for non-admin users", async () => {
    const response = await request(app)
      .get("/admin/system-settings")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 for an invalid group filter", async () => {
    const listMock = jest.mocked(SystemSettingService.list);
    listMock.mockRejectedValue(
      new ResponseErrorClass(
        400,
        "Invalid option: expected one of \"system\"|\"auth\"|\"downloads\"|\"public\"|\"uploads\"|\"limits\""
      )
    );

    const response = await request(app)
      .get("/admin/system-settings?group=invalid")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(Array.isArray(response.body.errors.general)).toBe(true);
  });
});

describe("GET /admin/system-settings", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }

  const trackedEmails = new Set<string>();

  afterEach(async () => {
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("returns the available system setting list", async () => {
    const { user: admin } = await createRealUser("system-settings-list", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .get("/admin/system-settings?group=auth")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(Array.isArray(response.body.data.items)).toBe(true);
    expect(
      response.body.data.items.some(
        (item: { key: string; group: string }) =>
          item.key === "auth.registration.enabled" && item.group === "auth"
      )
    ).toBe(true);
  });

  it("returns 403 for non-admin users", async () => {
    const { user } = await createRealUser("system-settings-list-forbidden");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .get("/admin/system-settings")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 for an invalid group filter", async () => {
    const { user: admin } = await createRealUser("system-settings-list-empty", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .get("/admin/system-settings?group=invalid")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(Array.isArray(response.body.errors.general)).toBe(true);
  });
});
