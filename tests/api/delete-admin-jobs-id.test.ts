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
let AdminJobService: typeof import("../../src/services/admin/job.service").AdminJobService;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/admin/job.service", () => ({
      AdminJobService: {
        delete: jest.fn(),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ AdminJobService } = await import("../../src/services/admin/job.service"));
});

afterAll(async () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    await disconnectPrisma();
  }
});

describe("DELETE /admin/jobs/:id", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deletes an admin job", async () => {
    const deleteMock = jest.mocked(AdminJobService.delete);
    deleteMock.mockResolvedValue(undefined as never);

    const response = await request(app)
      .delete(`/admin/jobs/${validId}`)
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
  });

  it("returns 403 for non-admin users", async () => {
    const response = await request(app)
      .delete(`/admin/jobs/${validId}`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the job id is invalid", async () => {
    const response = await request(app)
      .delete("/admin/jobs/invalid-id")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.id");
    expect(Array.isArray(response.body.errors.id)).toBe(true);
  });
});

describe("DELETE /admin/jobs/:id", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();
  const trackedCompanyIds = new Set<string>();
  const trackedRoleIds = new Set<string>();
  const trackedCityIds = new Set<string>();
  const trackedProvinceIds = new Set<string>();

  afterEach(async () => {
    const prisma = await loadPrisma();
    if (trackedCompanyIds.size > 0) {
      await prisma.company.deleteMany({
        where: { id: { in: [...trackedCompanyIds] } },
      });
    }
    if (trackedRoleIds.size > 0) {
      await prisma.jobRole.deleteMany({
        where: { id: { in: [...trackedRoleIds] } },
      });
    }
    if (trackedCityIds.size > 0) {
      await prisma.city.deleteMany({
        where: { id: { in: [...trackedCityIds] } },
      });
    }
    if (trackedProvinceIds.size > 0) {
      await prisma.province.deleteMany({
        where: { id: { in: [...trackedProvinceIds] } },
      });
    }
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
    trackedCompanyIds.clear();
    trackedRoleIds.clear();
    trackedCityIds.clear();
    trackedProvinceIds.clear();
  });

  it("deletes an admin job", async () => {
    const prisma = await loadPrisma();
    const { user: admin } = await createRealUser("admin-jobs-delete", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);
    const suffix = Date.now();
    const province = await prisma.province.create({
      data: { name: `Provinsi Delete ${suffix}` },
    });
    const city = await prisma.city.create({
      data: { provinceId: province.id, name: `Kota Delete ${suffix}` },
    });
    const company = await prisma.company.create({
      data: {
        name: `Company Delete ${suffix}`,
        slug: `company-delete-${suffix}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const jobRole = await prisma.jobRole.create({
      data: {
        name: `Role Delete ${suffix}`,
        slug: `role-delete-${suffix}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const job = await prisma.job.create({
      data: {
        companyId: company.id,
        jobRoleId: jobRole.id,
        cityId: city.id,
        title: `Delete Job ${suffix}`,
        slug: `delete-job-${suffix}`,
        jobType: "full_time",
        workSystem: "remote",
        educationLevel: "bachelor",
        minYearsOfExperience: 2,
        description: "Delete role description",
        requirements: "Delete role requirements",
        status: "draft",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedProvinceIds.add(province.id);
    trackedCityIds.add(city.id);
    trackedCompanyIds.add(company.id);
    trackedRoleIds.add(jobRole.id);

    const response = await request(app)
      .delete(`/admin/jobs/${job.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(204);

    const deleted = await prisma.job.findUnique({ where: { id: job.id } });
    expect(deleted).toBeNull();
  });

  it("returns 403 for non-admin users", async () => {
    const { user } = await createRealUser("admin-jobs-delete-forbidden");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .delete(`/admin/jobs/${validId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the job id is invalid", async () => {
    const { user: admin } = await createRealUser("admin-jobs-delete-invalid", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .delete("/admin/jobs/invalid-id")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.id");
    expect(Array.isArray(response.body.errors.id)).toBe(true);
  });
});
