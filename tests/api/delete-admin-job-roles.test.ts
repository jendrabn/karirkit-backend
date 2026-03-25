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
let AdminJobRoleService: typeof import("../../src/services/admin/job-role.service").AdminJobRoleService;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/admin/job-role.service", () => ({
      AdminJobRoleService: {
        massDelete: jest.fn(),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ AdminJobRoleService } = await import(
    "../../src/services/admin/job-role.service"
  ));
});

afterAll(async () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    await disconnectPrisma();
  }
});

describe("DELETE /admin/job-roles", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deletes multiple job roles", async () => {
    const massDeleteMock = jest.mocked(AdminJobRoleService.massDelete);
    massDeleteMock.mockResolvedValue({
      deleted_count: 1,
      ids: [validId],
    } as never);

    const response = await request(app)
      .delete("/admin/job-roles")
      .set("Authorization", "Bearer admin-token")
      .send({ ids: [validId] });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      deleted_count: 1,
      ids: [validId],
    });
  });

  it("returns 403 for non-admin users", async () => {
    const response = await request(app)
      .delete("/admin/job-roles")
      .set("Authorization", "Bearer user-token")
      .send({ ids: [validId] });

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the ids payload is empty", async () => {
    const response = await request(app)
      .delete("/admin/job-roles")
      .set("Authorization", "Bearer admin-token")
      .send({ ids: [] });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.ids");
    expect(Array.isArray(response.body.errors.ids)).toBe(true);
  });
});

describe("DELETE /admin/job-roles", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();
  const trackedRoleIds = new Set<string>();

  afterEach(async () => {
    const prisma = await loadPrisma();
    if (trackedRoleIds.size > 0) {
      await prisma.jobRole.deleteMany({
        where: {
          id: { in: [...trackedRoleIds] },
        },
      });
    }
    trackedRoleIds.clear();
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("deletes multiple job roles", async () => {
    const prisma = await loadPrisma();
    const { user: admin } = await createRealUser("admin-job-roles-mass-delete", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);
    const first = await prisma.jobRole.create({
      data: {
        name: "Mass Delete Role One",
        slug: "mass-delete-role-one",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const second = await prisma.jobRole.create({
      data: {
        name: "Mass Delete Role Two",
        slug: "mass-delete-role-two",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedRoleIds.add(first.id);
    trackedRoleIds.add(second.id);

    const response = await request(app)
      .delete("/admin/job-roles")
      .set("Authorization", `Bearer ${token}`)
      .send({ ids: [first.id, second.id] });

    expect(response.status).toBe(200);
    expect(response.body.data.deleted_count).toBe(2);
    expect(response.body.data.message).toBe("2 job role berhasil dihapus");

    trackedRoleIds.delete(first.id);
    trackedRoleIds.delete(second.id);
    const remaining = await prisma.jobRole.count({
      where: {
        id: { in: [first.id, second.id] },
      },
    });
    expect(remaining).toBe(0);
  });

  it("returns 403 for non-admin users", async () => {
    const { user } = await createRealUser("admin-job-roles-mass-delete-forbidden");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .delete("/admin/job-roles")
      .set("Authorization", `Bearer ${token}`)
      .send({ ids: [validId] });

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the ids payload is empty", async () => {
    const { user: admin } = await createRealUser("admin-job-roles-mass-delete-empty", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .delete("/admin/job-roles")
      .set("Authorization", `Bearer ${token}`)
      .send({ ids: [] });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.ids");
    expect(Array.isArray(response.body.errors.ids)).toBe(true);
  });
});
