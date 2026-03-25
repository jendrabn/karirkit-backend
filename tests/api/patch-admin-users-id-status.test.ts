import request from "supertest";
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
        updateStatus: jest.fn(),
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

describe("PATCH /admin/users/:id/status", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("updates user status", async () => {
    const updateStatusMock = jest.mocked(UserService.updateStatus);
    updateStatusMock.mockResolvedValue({
      id: validId,
      status: "suspended",
      status_reason: "Pelanggaran kebijakan",
    } as never);

    const response = await request(app)
      .patch(`/admin/users/${validId}/status`)
      .set("Authorization", "Bearer admin-token")
      .send({
        status: "suspended",
        status_reason: "Pelanggaran kebijakan",
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: validId,
      status: "suspended",
      status_reason: "Pelanggaran kebijakan",
    });
  });

  it("returns 403 for non-admin users", async () => {
    const response = await request(app)
      .patch(`/admin/users/${validId}/status`)
      .set("Authorization", "Bearer user-token")
      .send({ status: "suspended" });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns validation errors for invalid patch payloads", async () => {
    const updateStatusMock = jest.mocked(UserService.updateStatus);
    updateStatusMock.mockRejectedValue(
      new ResponseErrorClass(400, "Validation error", {
        suspended_until: ["Format tanggal penangguhan tidak valid"],
      }),
    );

    const response = await request(app)
      .patch(`/admin/users/${validId}/status`)
      .set("Authorization", "Bearer admin-token")
      .send({
        status: "suspended",
        suspended_until: "invalid-date",
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.suspended_until");
    expect(Array.isArray(response.body.errors.suspended_until)).toBe(true);
  });
});

describe("PATCH /admin/users/:id/status", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();

  afterEach(async () => {
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("updates user status", async () => {
    const prisma = await loadPrisma();
    const { user: admin } = await createRealUser("admin-users-status-admin", {
      role: "admin",
    });
    const { user: target } = await createRealUser("admin-users-status-target");
    trackedEmails.add(admin.email);
    trackedEmails.add(target.email);
    const token = await createSessionToken(admin);
    const suspendedUntil = "2030-01-01T00:00:00.000Z";

    const response = await request(app)
      .patch(`/admin/users/${target.id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        status: "suspended",
        status_reason: "Manual review",
        suspended_until: suspendedUntil,
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: target.id,
      status: "suspended",
      status_reason: "Manual review",
    });
    expect(typeof response.body.data.suspended_until).toBe("string");

    const stored = await prisma.user.findUnique({ where: { id: target.id } });
    expect(stored?.status).toBe("suspended");
  });

  it("returns 403 for non-admin users", async () => {
    const { user } = await createRealUser("admin-users-status-forbidden");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .patch(`/admin/users/${validId}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "suspended" });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns validation errors for invalid patch payloads", async () => {
    const { user: admin } = await createRealUser("admin-users-status-invalid", {
      role: "admin",
    });
    const { user: target } = await createRealUser(
      "admin-users-status-invalid-target"
    );
    trackedEmails.add(admin.email);
    trackedEmails.add(target.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .patch(`/admin/users/${target.id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        status: "suspended",
        suspended_until: "not-a-date",
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.suspended_until");
    expect(Array.isArray(response.body.errors.suspended_until)).toBe(true);
  });
});
