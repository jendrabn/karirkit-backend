import request from "supertest";
import {
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
} from "./real-mode";

const validId = "550e8400-e29b-41d4-a716-446655440000";
let app: typeof import("../../src/index").default;
let UserService: typeof import("../../src/services/admin/user.service").UserService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/admin/user.service", () => ({
      UserService: {
        get: jest.fn(),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ UserService } = await import("../../src/services/admin/user.service"));
  ({ ResponseError: ResponseErrorClass } = await import(
    "../../src/utils/response-error.util"
  ));
});

afterAll(async () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    await disconnectPrisma();
  }
});

describe("GET /admin/users/:id", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns user details", async () => {
    const getMock = jest.mocked(UserService.get);
    getMock.mockResolvedValue({
      id: validId,
      name: "User Detail",
      email: "detail@example.com",
    } as never);

    const response = await request(app)
      .get(`/admin/users/${validId}`)
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: validId,
      name: "User Detail",
      email: "detail@example.com",
    });
    expect(typeof response.body.data.id).toBe("string");
  });

  it("returns 403 when the requester is not an admin", async () => {
    const response = await request(app)
      .get(`/admin/users/${validId}`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 404 when the user does not exist", async () => {
    const getMock = jest.mocked(UserService.get);
    getMock.mockRejectedValue(
      new ResponseErrorClass(404, "Pengguna tidak ditemukan"),
    );

    const response = await request(app)
      .get(`/admin/users/${validId}`)
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Pengguna tidak ditemukan");
  });
});

describe("GET /admin/users/:id", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();

  afterEach(async () => {
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("returns user details", async () => {
    const { user: admin } = await createRealUser("admin-users-get-admin", {
      role: "admin",
    });
    const { user: target } = await createRealUser("admin-users-get-target");
    trackedEmails.add(admin.email);
    trackedEmails.add(target.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .get(`/admin/users/${target.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: target.id,
      email: target.email,
      username: target.username,
      last_login_at: null,
      subscription_plan: "free",
      subscription_expires_at: null,
      download_total_count: 0,
      download_today_count: 0,
    });
    expect(response.body.data).not.toHaveProperty("download_stats");
    expect(response.body.data).not.toHaveProperty("daily_download_limit");
    expect(response.body.data).not.toHaveProperty("document_storage_limit");
    expect(response.body.data).not.toHaveProperty("document_storage_stats");
  });

  it("returns profile-shaped data without subscription limit fields", async () => {
    const { user: admin } = await createRealUser("admin-users-get-stats-admin", {
      role: "admin",
      planId: "pro",
    });
    const { user: target } = await createRealUser("admin-users-get-stats-target", {
      role: "admin",
      planId: "free",
    });
    trackedEmails.add(admin.email);
    trackedEmails.add(target.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .get(`/admin/users/${target.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: target.id,
      role: target.role,
      status: target.status,
      last_login_at: null,
      subscription_plan: "free",
      subscription_expires_at: null,
      download_total_count: 0,
      download_today_count: 0,
    });
    expect(response.body.data).not.toHaveProperty("download_stats");
    expect(response.body.data).not.toHaveProperty("daily_download_limit");
    expect(response.body.data).not.toHaveProperty("document_storage_limit");
    expect(response.body.data).not.toHaveProperty("document_storage_stats");
  });

  it("returns 403 when the requester is not an admin", async () => {
    const { user } = await createRealUser("admin-users-get-forbidden");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .get(`/admin/users/${validId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 404 when the user does not exist", async () => {
    const { user: admin } = await createRealUser("admin-users-get-missing", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .get("/admin/users/550e8400-e29b-41d4-a716-446655440099")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Pengguna tidak ditemukan");
  });
});
