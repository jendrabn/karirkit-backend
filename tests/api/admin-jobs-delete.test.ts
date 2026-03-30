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
        massDelete: jest.fn(),
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

describe("DELETE /admin/jobs", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deletes multiple admin jobs", async () => {
    const massDeleteMock = jest.mocked(AdminJobService.massDelete);
    massDeleteMock.mockResolvedValue({
      deleted_count: 1,
      ids: [validId],
    } as never);

    const response = await request(app)
      .delete("/admin/jobs")
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
      .delete("/admin/jobs")
      .set("Authorization", "Bearer user-token")
      .send({ ids: [validId] });

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the ids payload is empty", async () => {
    const response = await request(app)
      .delete("/admin/jobs")
      .set("Authorization", "Bearer admin-token")
      .send({ ids: [] });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.ids");
    expect(Array.isArray(response.body.errors.ids)).toBe(true);
  });
});

describe("DELETE /admin/jobs", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();
  const trackedJobIds = new Set<string>();
  const trackedCompanyIds = new Set<string>();
  const trackedRoleIds = new Set<string>();
  const trackedCityIds = new Set<string>();
  const trackedProvinceIds = new Set<string>();

  afterEach(async () => {
    const prisma = await loadPrisma();
    if (trackedJobIds.size > 0) {
      await prisma.job.deleteMany({
        where: { id: { in: [...trackedJobIds] } },
      });
    }
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
    trackedJobIds.clear();
    trackedCompanyIds.clear();
    trackedRoleIds.clear();
    trackedCityIds.clear();
    trackedProvinceIds.clear();
  });

  it("deletes multiple admin jobs", async () => {
    const prisma = await loadPrisma();
    const { user: admin } = await createRealUser("admin-jobs-mass-delete", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);
    const suffix = Date.now();
    const province = await prisma.province.create({
      data: { name: `Provinsi Mass Delete ${suffix}` },
    });
    const city = await prisma.city.create({
      data: { provinceId: province.id, name: `Kota Mass Delete ${suffix}` },
    });
    const company = await prisma.company.create({
      data: {
        name: `Company Mass Delete ${suffix}`,
        slug: `company-mass-delete-${suffix}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const jobRole = await prisma.jobRole.create({
      data: {
        name: `Role Mass Delete ${suffix}`,
        slug: `role-mass-delete-${suffix}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const jobs = await Promise.all(
      ["alpha", "beta"].map((name) =>
        prisma.job.create({
          data: {
            companyId: company.id,
            jobRoleId: jobRole.id,
            cityId: city.id,
            title: `Job ${name} ${suffix}`,
            slug: `job-${name}-${suffix}`,
            jobType: "full_time",
            workSystem: "remote",
            educationLevel: "bachelor",
            minYearsOfExperience: 2,
            description: `Description ${name}`,
            requirements: `Requirements ${name}`,
            status: "draft",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        })
      )
    );
    trackedProvinceIds.add(province.id);
    trackedCityIds.add(city.id);
    trackedCompanyIds.add(company.id);
    trackedRoleIds.add(jobRole.id);

    const response = await request(app)
      .delete("/admin/jobs")
      .set("Authorization", `Bearer ${token}`)
      .send({ ids: jobs.map((job: { id: string }) => job.id) });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      deleted_count: 2,
    });

    const remaining = await prisma.job.findMany({
      where: { id: { in: jobs.map((job: { id: string }) => job.id) } },
    });
    expect(remaining).toHaveLength(0);
  });

  it("returns 403 for non-admin users", async () => {
    const { user } = await createRealUser("admin-jobs-mass-delete-forbidden");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .delete("/admin/jobs")
      .set("Authorization", `Bearer ${token}`)
      .send({ ids: [validId] });

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 404 when one of the jobs is missing", async () => {
    const prisma = await loadPrisma();
    const { user: admin } = await createRealUser("admin-jobs-mass-delete-missing", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);
    const suffix = Date.now();
    const province = await prisma.province.create({
      data: { name: `Provinsi Mass Delete Missing ${suffix}` },
    });
    const city = await prisma.city.create({
      data: { provinceId: province.id, name: `Kota Mass Delete Missing ${suffix}` },
    });
    const company = await prisma.company.create({
      data: {
        name: `Company Mass Delete Missing ${suffix}`,
        slug: `company-mass-delete-missing-${suffix}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const jobRole = await prisma.jobRole.create({
      data: {
        name: `Role Mass Delete Missing ${suffix}`,
        slug: `role-mass-delete-missing-${suffix}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const job = await prisma.job.create({
      data: {
        companyId: company.id,
        jobRoleId: jobRole.id,
        cityId: city.id,
        title: `Job Missing ${suffix}`,
        slug: `job-missing-${suffix}`,
        jobType: "full_time",
        workSystem: "remote",
        educationLevel: "bachelor",
        minYearsOfExperience: 2,
        description: "Description missing",
        requirements: "Requirements missing",
        status: "draft",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedJobIds.add(job.id);
    trackedProvinceIds.add(province.id);
    trackedCityIds.add(city.id);
    trackedCompanyIds.add(company.id);
    trackedRoleIds.add(jobRole.id);

    const response = await request(app)
      .delete("/admin/jobs")
      .set("Authorization", `Bearer ${token}`)
      .send({ ids: [job.id, "550e8400-e29b-41d4-a716-446655440099"] });

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe(
      "Satu atau lebih lowongan pekerjaan tidak ditemukan"
    );
  });
});
