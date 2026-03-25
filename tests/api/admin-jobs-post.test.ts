import request from "supertest";
import {
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
  loadPrisma,
} from "./real-mode";

let app: typeof import("../../src/index").default;
let AdminJobService: typeof import("../../src/services/admin/job.service").AdminJobService;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/admin/job.service", () => ({
      AdminJobService: {
        create: jest.fn(),
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

describe("POST /admin/jobs", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  const companyId = "550e8400-e29b-41d4-a716-446655440001";
  const roleId = "550e8400-e29b-41d4-a716-446655440002";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a job posting for admins", async () => {
    const createMock = jest.mocked(AdminJobService.create);
    createMock.mockResolvedValue({
      id: "job-1",
      title: "Senior Backend Engineer",
    } as never);

    const response = await request(app)
      .post("/admin/jobs")
      .set("Authorization", "Bearer admin-token")
      .send({
        company_id: companyId,
        job_role_id: roleId,
        city_id: "3171",
        title: "Senior Backend Engineer",
        job_type: "full_time",
        work_system: "remote",
        education_level: "bachelor",
        min_years_of_experience: 2,
        description: "Detailed backend engineering role.",
        requirements: "Detailed backend engineering requirements.",
        status: "published",
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: "job-1",
      title: "Senior Backend Engineer",
    });
  });

  it("returns 403 for non-admin users", async () => {
    const response = await request(app)
      .post("/admin/jobs")
      .set("Authorization", "Bearer user-token")
      .send({});

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the job payload is invalid", async () => {
    const response = await request(app)
      .post("/admin/jobs")
      .set("Authorization", "Bearer admin-token")
      .send({
        company_id: companyId,
        job_role_id: roleId,
        title: "Hi",
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.title");
    expect(Array.isArray(response.body.errors.title)).toBe(true);
  });
});

describe("POST /admin/jobs", () => {
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

  it("creates a job posting for admins", async () => {
    const prisma = await loadPrisma();
    const { user: admin } = await createRealUser("admin-jobs-create", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);
    const suffix = Date.now();
    const province = await prisma.province.create({
      data: { name: `Provinsi ${suffix}` },
    });
    const city = await prisma.city.create({
      data: { provinceId: province.id, name: `Kota ${suffix}` },
    });
    const company = await prisma.company.create({
      data: {
        name: `Company ${suffix}`,
        slug: `company-${suffix}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const jobRole = await prisma.jobRole.create({
      data: {
        name: `Role ${suffix}`,
        slug: `role-${suffix}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedProvinceIds.add(province.id);
    trackedCityIds.add(city.id);
    trackedCompanyIds.add(company.id);
    trackedRoleIds.add(jobRole.id);

    const response = await request(app)
      .post("/admin/jobs")
      .set("Authorization", `Bearer ${token}`)
      .send({
        company_id: company.id,
        job_role_id: jobRole.id,
        city_id: city.id,
        title: `Senior Backend Engineer ${suffix}`,
        job_type: "full_time",
        work_system: "remote",
        education_level: "bachelor",
        min_years_of_experience: 2,
        description: "Detailed backend engineering role.",
        requirements: "Detailed backend engineering requirements.",
        medias: [{ path: "https://example.com/job-hero.png" }],
        status: "published",
        expiration_date: "2027-01-01T00:00:00.000Z",
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      title: `Senior Backend Engineer ${suffix}`,
      company_id: company.id,
      job_role_id: jobRole.id,
      city_id: city.id,
      job_type: "full_time",
      status: "published",
    });
    expect(response.body.data.slug).toContain(`senior-backend-engineer-${suffix}`);
    expect(Array.isArray(response.body.data.medias)).toBe(true);
    expect(response.body.data.medias[0]).toMatchObject({
      path: "https://example.com/job-hero.png",
    });
    trackedJobIds.add(response.body.data.id);
  });

  it("returns 403 for non-admin users", async () => {
    const { user } = await createRealUser("admin-jobs-create-forbidden");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .post("/admin/jobs")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the job payload is invalid", async () => {
    const prisma = await loadPrisma();
    const { user: admin } = await createRealUser("admin-jobs-create-invalid", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);
    const suffix = Date.now();
    const company = await prisma.company.create({
      data: {
        name: `Company Invalid ${suffix}`,
        slug: `company-invalid-${suffix}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const jobRole = await prisma.jobRole.create({
      data: {
        name: `Role Invalid ${suffix}`,
        slug: `role-invalid-${suffix}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedCompanyIds.add(company.id);
    trackedRoleIds.add(jobRole.id);

    const response = await request(app)
      .post("/admin/jobs")
      .set("Authorization", `Bearer ${token}`)
      .send({
        company_id: company.id,
        job_role_id: jobRole.id,
        title: "Hi",
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.title");
    expect(Array.isArray(response.body.errors.title)).toBe(true);
  });
});
