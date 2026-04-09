import request from "supertest";
import bcrypt from "bcrypt";
import {
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
  loadPrisma,
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
        update: jest.fn(),
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

describe("PUT /admin/users/:id", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("updates a user record", async () => {
    const updateMock = jest.mocked(UserService.update);
    updateMock.mockResolvedValue({
      id: validId,
      name: "User Diperbarui",
      email: "updated@example.com",
    } as never);

    const response = await request(app)
      .put(`/admin/users/${validId}`)
      .set("Authorization", "Bearer admin-token")
      .send({ name: "User Diperbarui" });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: validId,
      name: "User Diperbarui",
      email: "updated@example.com",
    });
    expect(typeof response.body.data.name).toBe("string");
  });

  it("returns 403 when a non-admin user updates the resource", async () => {
    const response = await request(app)
      .put(`/admin/users/${validId}`)
      .set("Authorization", "Bearer user-token")
      .send({ name: "User Diperbarui" });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns validation errors for invalid updates", async () => {
    const updateMock = jest.mocked(UserService.update);
    updateMock.mockRejectedValue(
      new ResponseErrorClass(400, "Validation error", {
        email: ["Format email tidak valid"],
      }),
    );

    const response = await request(app)
      .put(`/admin/users/${validId}`)
      .set("Authorization", "Bearer admin-token")
      .send({ email: "invalid-email" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.email");
    expect(Array.isArray(response.body.errors.email)).toBe(true);
  });
});

describe("PUT /admin/users/:id", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();

  afterEach(async () => {
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("updates a user record", async () => {
    const prisma = await loadPrisma();
    const suffix = `${Date.now()}`;
    const { user: admin } = await createRealUser("admin-users-update-admin", {
      role: "admin",
    });
    const { user: target } = await createRealUser("admin-users-update-target");
    trackedEmails.add(admin.email);
    trackedEmails.add(target.email);
    const token = await createSessionToken(admin);
    const updatedEmail = `admin-users-updated-${suffix}@example.com`;
    trackedEmails.add(updatedEmail);

    const response = await request(app)
      .put(`/admin/users/${target.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: `Updated Name ${suffix}`,
        username: `updated-name-${suffix}`,
        email: updatedEmail,
        location: "Jakarta",
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: target.id,
      name: `Updated Name ${suffix}`,
      username: `updated-name-${suffix}`,
      email: updatedEmail,
      location: "Jakarta",
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

    const stored = await prisma.user.findUnique({ where: { id: target.id } });
    expect(stored?.email).toBe(updatedEmail);
    expect(stored?.location).toBe("Jakarta");
  });

  it("returns 403 when a non-admin user updates the resource", async () => {
    const { user } = await createRealUser("admin-users-update-forbidden");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .put(`/admin/users/${validId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "User Diperbarui" });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns validation errors for invalid updates", async () => {
    const { user: admin } = await createRealUser("admin-users-update-invalid", {
      role: "admin",
    });
    const { user: target } = await createRealUser(
      "admin-users-update-invalid-target"
    );
    trackedEmails.add(admin.email);
    trackedEmails.add(target.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .put(`/admin/users/${target.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "invalid-email" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.email");
    expect(Array.isArray(response.body.errors.email)).toBe(true);
  });

  it("updates the password when a non-empty password is provided", async () => {
    const prisma = await loadPrisma();
    const { user: admin } = await createRealUser(
      "admin-users-update-password-admin",
      {
        role: "admin",
      }
    );
    const { user: target } = await createRealUser(
      "admin-users-update-password-target"
    );
    trackedEmails.add(admin.email);
    trackedEmails.add(target.email);
    const token = await createSessionToken(admin);
    const newPassword = "newsecret123";

    const response = await request(app)
      .put(`/admin/users/${target.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ password: newPassword });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.id", target.id);

    const stored = await prisma.user.findUnique({
      where: { id: target.id },
      select: {
        password: true,
        sessionInvalidBefore: true,
        passwordResetTokenId: true,
      },
    });

    expect(stored).not.toBeNull();
    expect(stored?.password).toBeDefined();
    expect(stored?.passwordResetTokenId).toBeNull();
    expect(stored?.sessionInvalidBefore).not.toBeNull();
    expect(await bcrypt.compare(newPassword, stored!.password)).toBe(true);
  });

  it("ignores an empty password value", async () => {
    const prisma = await loadPrisma();
    const { user: admin } = await createRealUser(
      "admin-users-update-password-empty-admin",
      {
        role: "admin",
      }
    );
    const { user: target } = await createRealUser(
      "admin-users-update-password-empty-target"
    );
    trackedEmails.add(admin.email);
    trackedEmails.add(target.email);
    const token = await createSessionToken(admin);

    const before = await prisma.user.findUnique({
      where: { id: target.id },
      select: { password: true },
    });

    const response = await request(app)
      .put(`/admin/users/${target.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ password: "" });

    expect(response.status).toBe(200);
    const after = await prisma.user.findUnique({
      where: { id: target.id },
      select: { password: true, sessionInvalidBefore: true },
    });

    expect(before).not.toBeNull();
    expect(after).not.toBeNull();
    expect(after?.password).toBe(before?.password);
    expect(after?.sessionInvalidBefore).toBeNull();
  });
});
