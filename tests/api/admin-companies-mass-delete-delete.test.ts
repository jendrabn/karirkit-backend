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
let AdminCompanyService: typeof import("../../src/services/admin/company.service").AdminCompanyService;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/admin/company.service", () => ({
      AdminCompanyService: {
        massDelete: jest.fn(),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ AdminCompanyService } = await import(
    "../../src/services/admin/company.service"
  ));
});

afterAll(async () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    await disconnectPrisma();
  }
});

describe("DELETE /admin/companies/mass-delete", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deletes multiple companies", async () => {
    const massDeleteMock = jest.mocked(AdminCompanyService.massDelete);
    massDeleteMock.mockResolvedValue({
      deleted_count: 1,
      ids: [validId],
    } as never);

    const response = await request(app)
      .delete("/admin/companies/mass-delete")
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
      .delete("/admin/companies/mass-delete")
      .set("Authorization", "Bearer user-token")
      .send({ ids: [validId] });

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the ids payload is empty", async () => {
    const response = await request(app)
      .delete("/admin/companies/mass-delete")
      .set("Authorization", "Bearer admin-token")
      .send({ ids: [] });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.ids");
    expect(Array.isArray(response.body.errors.ids)).toBe(true);
  });
});

describe("DELETE /admin/companies/mass-delete", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();
  const trackedCompanyIds = new Set<string>();

  afterEach(async () => {
    const prisma = await loadPrisma();
    if (trackedCompanyIds.size > 0) {
      await prisma.company.deleteMany({
        where: {
          id: { in: [...trackedCompanyIds] },
        },
      });
    }
    trackedCompanyIds.clear();
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("deletes multiple companies", async () => {
    const prisma = await loadPrisma();
    const { user: admin } = await createRealUser("admin-companies-mass-delete", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);
    const first = await prisma.company.create({
      data: {
        name: "Mass Delete Company One",
        slug: "mass-delete-company-one",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const second = await prisma.company.create({
      data: {
        name: "Mass Delete Company Two",
        slug: "mass-delete-company-two",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedCompanyIds.add(first.id);
    trackedCompanyIds.add(second.id);

    const response = await request(app)
      .delete("/admin/companies/mass-delete")
      .set("Authorization", `Bearer ${token}`)
      .send({ ids: [first.id, second.id] });

    expect(response.status).toBe(200);
    expect(response.body.data.deleted_count).toBe(2);
    expect(response.body.data.message).toBe("2 perusahaan berhasil dihapus");

    trackedCompanyIds.delete(first.id);
    trackedCompanyIds.delete(second.id);
    const remaining = await prisma.company.count({
      where: { id: { in: [first.id, second.id] } },
    });
    expect(remaining).toBe(0);
  });

  it("returns 403 for non-admin users", async () => {
    const { user } = await createRealUser("admin-companies-mass-delete-forbidden");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .delete("/admin/companies/mass-delete")
      .set("Authorization", `Bearer ${token}`)
      .send({ ids: [validId] });

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the ids payload is empty", async () => {
    const { user: admin } = await createRealUser("admin-companies-mass-delete-empty", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .delete("/admin/companies/mass-delete")
      .set("Authorization", `Bearer ${token}`)
      .send({ ids: [] });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.ids");
    expect(Array.isArray(response.body.errors.ids)).toBe(true);
  });
});
