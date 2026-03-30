import request from "supertest";
import {
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
  loadPrisma,
} from "./real-mode";

let app: typeof import("../../src/index").default;
let UserService: typeof import("../../src/services/admin/user.service").UserService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/admin/user.service", () => ({
      UserService: {
        create: jest.fn(),
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

describe("POST /admin/users", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a user record", async () => {
    const createMock = jest.mocked(UserService.create);
    createMock.mockResolvedValue({
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "User Baru",
      email: "user@example.com",
    } as never);

    const response = await request(app)
      .post("/admin/users")
      .set("Authorization", "Bearer admin-token")
      .send({ name: "User Baru" });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "User Baru",
      email: "user@example.com",
    });
    expect(typeof response.body.data.id).toBe("string");
  });

  it("returns 403 when a non-admin user calls the endpoint", async () => {
    const response = await request(app)
      .post("/admin/users")
      .set("Authorization", "Bearer user-token")
      .send({ name: "User Baru" });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns validation errors for invalid payloads", async () => {
    const createMock = jest.mocked(UserService.create);
    createMock.mockRejectedValue(
      new ResponseErrorClass(400, "Validation error", {
        email: ["Format email tidak valid"],
      }),
    );

    const response = await request(app)
      .post("/admin/users")
      .set("Authorization", "Bearer admin-token")
      .send({ email: "invalid-email" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.email");
    expect(Array.isArray(response.body.errors.email)).toBe(true);
  });
});

describe("POST /admin/users", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();

  afterEach(async () => {
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("creates a user record", async () => {
    const prisma = await loadPrisma();
    const suffix = `${Date.now()}`;
    const { user: admin } = await createRealUser("admin-users-create-admin", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);
    const email = `admin-users-created-${suffix}@example.com`;
    trackedEmails.add(email);

    const response = await request(app)
      .post("/admin/users")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: `Admin User Created ${suffix}`,
        username: `admin-user-created-${suffix}`,
        email,
        password: "secret123",
        role: "user",
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      name: `Admin User Created ${suffix}`,
      username: `admin-user-created-${suffix}`,
      email,
      role: "user",
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

    const stored = await prisma.user.findUnique({ where: { email } });
    expect(stored).not.toBeNull();
    expect(stored?.name).toBe(`Admin User Created ${suffix}`);
  });

  it("always uses free plan defaults for non-subscribed users", async () => {
    const prisma = await loadPrisma();
    const suffix = `${Date.now()}`;
    const { user: admin } = await createRealUser("admin-users-create-defaults", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);
    const email = `admin-users-defaults-${suffix}@example.com`;
    trackedEmails.add(email);

    const response = await request(app)
      .post("/admin/users")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: `Admin User Defaults ${suffix}`,
        username: `admin-user-defaults-${suffix}`,
        email,
        password: "secret123",
        role: "user",
      });

    expect(response.status).toBe(201);

    const stored = await prisma.user.findUnique({ where: { email } });
    expect(stored).not.toBeNull();
    expect(stored?.subscriptionPlan).toBe("free");
    expect(response.body.data.download_total_count).toBe(0);
    expect(response.body.data.download_today_count).toBe(0);
    expect(response.body.data).not.toHaveProperty("daily_download_limit");
    expect(response.body.data).not.toHaveProperty("document_storage_limit");
    expect(response.body.data).not.toHaveProperty("document_storage_stats");
  });

  it("returns 403 when a non-admin user calls the endpoint", async () => {
    const { user } = await createRealUser("admin-users-create-forbidden");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .post("/admin/users")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Forbidden User",
        username: "forbidden-user",
        email: "forbidden-user@example.com",
        password: "secret123",
      });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns validation errors for invalid payloads", async () => {
    const { user: admin } = await createRealUser("admin-users-create-invalid", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .post("/admin/users")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Ab",
        username: "ab",
        email: "invalid-email",
        password: "123",
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.name");
    expect(response.body).toHaveProperty("errors.email");
    expect(Array.isArray(response.body.errors.email)).toBe(true);
  });
});
