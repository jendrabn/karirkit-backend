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
        massDelete: jest.fn(),
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

describe("DELETE /admin/users/mass-delete", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deletes multiple user records", async () => {
    const massDeleteMock = jest.mocked(UserService.massDelete);
    massDeleteMock.mockResolvedValue({
      message: "2 pengguna berhasil dihapus",
      deleted_count: 2,
    } as never);

    const response = await request(app)
      .delete("/admin/users/mass-delete")
      .set("Authorization", "Bearer admin-token")
      .send({
        ids: [
          "550e8400-e29b-41d4-a716-446655440000",
          "660e8400-e29b-41d4-a716-446655440000",
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      message: "2 pengguna berhasil dihapus",
      deleted_count: 2,
    });
    expect(typeof response.body.data.deleted_count).toBe("number");
  });

  it("returns 403 for non-admin users", async () => {
    const response = await request(app)
      .delete("/admin/users/mass-delete")
      .set("Authorization", "Bearer user-token")
      .send({ ids: ["550e8400-e29b-41d4-a716-446655440000"] });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns validation errors when no ids are provided", async () => {
    const massDeleteMock = jest.mocked(UserService.massDelete);
    massDeleteMock.mockRejectedValue(
      new ResponseErrorClass(400, "Validation error", {
        ids: ["Minimal satu ID harus dipilih"],
      }),
    );

    const response = await request(app)
      .delete("/admin/users/mass-delete")
      .set("Authorization", "Bearer admin-token")
      .send({ ids: [] });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.ids");
    expect(Array.isArray(response.body.errors.ids)).toBe(true);
  });
});

describe("DELETE /admin/users/mass-delete", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();

  afterEach(async () => {
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("deletes multiple user records", async () => {
    const prisma = await loadPrisma();
    const { user: admin } = await createRealUser(
      "admin-users-mass-delete-admin",
      { role: "admin" }
    );
    const { user: first } = await createRealUser(
      "admin-users-mass-delete-first"
    );
    const { user: second } = await createRealUser(
      "admin-users-mass-delete-second"
    );
    trackedEmails.add(admin.email);
    trackedEmails.add(first.email);
    trackedEmails.add(second.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .delete("/admin/users/mass-delete")
      .set("Authorization", `Bearer ${token}`)
      .send({ ids: [first.id, second.id] });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      deleted_count: 2,
      message: "2 pengguna berhasil dihapus",
    });

    const found = await prisma.user.findMany({
      where: { id: { in: [first.id, second.id] } },
    });
    expect(found).toHaveLength(0);
  });

  it("returns 403 for non-admin users", async () => {
    const { user } = await createRealUser("admin-users-mass-delete-forbidden");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .delete("/admin/users/mass-delete")
      .set("Authorization", `Bearer ${token}`)
      .send({ ids: ["550e8400-e29b-41d4-a716-446655440000"] });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns validation errors when no ids are provided", async () => {
    const { user: admin } = await createRealUser(
      "admin-users-mass-delete-invalid",
      { role: "admin" }
    );
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .delete("/admin/users/mass-delete")
      .set("Authorization", `Bearer ${token}`)
      .send({ ids: [] });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.ids");
    expect(Array.isArray(response.body.errors.ids)).toBe(true);
  });
});
