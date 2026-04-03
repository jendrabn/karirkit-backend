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
        update: jest.fn(),
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

describe("PUT /admin/jobs/:id", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("updates an admin job", async () => {
    const updateMock = jest.mocked(AdminJobService.update);
    updateMock.mockResolvedValue({
      id: validId,
      title: "Updated Backend Engineer",
    } as never);

    const response = await request(app)
      .put(`/admin/jobs/${validId}`)
      .set("Authorization", "Bearer admin-token")
      .send({
        title: "Updated Backend Engineer",
        description: "Updated backend engineering role.",
        requirements: "Updated backend engineering requirements.",
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: validId,
      title: "Updated Backend Engineer",
    });
  });

  it("returns 403 for non-admin users", async () => {
    const response = await request(app)
      .put(`/admin/jobs/${validId}`)
      .set("Authorization", "Bearer user-token")
      .send({});

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the update payload is invalid", async () => {
    const response = await request(app)
      .put(`/admin/jobs/${validId}`)
      .set("Authorization", "Bearer admin-token")
      .send({
        title: "No",
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.title");
    expect(Array.isArray(response.body.errors.title)).toBe(true);
  });
});

describe("PUT /admin/jobs/:id", () => {
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

  it("updates an admin job", async () => {
    const prisma = await loadPrisma();
    const { user: admin } = await createRealUser("admin-jobs-update", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);
    const suffix = Date.now();
    const province = await prisma.province.create({
      data: { name: `Provinsi Update ${suffix}` },
    });
    const city = await prisma.city.create({
      data: { provinceId: province.id, name: `Kota Update ${suffix}` },
    });
    const company = await prisma.company.create({
      data: {
        name: `Company Update ${suffix}`,
        slug: `company-update-${suffix}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const jobRole = await prisma.jobRole.create({
      data: {
        name: `Role Update ${suffix}`,
        slug: `role-update-${suffix}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const job = await prisma.job.create({
      data: {
        companyId: company.id,
        jobRoleId: jobRole.id,
        cityId: city.id,
        title: `Backend Engineer ${suffix}`,
        slug: `backend-engineer-${suffix}`,
        jobType: "full_time",
        workSystem: "remote",
        educationLevel: "bachelor",
        minYearsOfExperience: 2,
        description: "Initial backend role",
        requirements: "Initial backend requirements",
        status: "draft",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedProvinceIds.add(province.id);
    trackedCityIds.add(city.id);
    trackedCompanyIds.add(company.id);
    trackedRoleIds.add(jobRole.id);
    trackedJobIds.add(job.id);

    const response = await request(app)
      .put(`/admin/jobs/${job.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: `Updated Backend Engineer ${suffix}`,
        description: "Updated backend engineering role.",
        requirements: "Updated backend engineering requirements.",
        status: "published",
        salary_min: 15000000,
        salary_max: 25000000,
        medias: [{ path: "https://example.com/job-updated.png" }],
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: job.id,
      title: `Updated Backend Engineer ${suffix}`,
      status: "published",
      salary_min: "15000000",
      salary_max: "25000000",
    });
    expect(Array.isArray(response.body.data.medias)).toBe(true);
    expect(response.body.data.medias[0]).toMatchObject({
      path: "https://example.com/job-updated.png",
    });
  });

  it("returns 403 for non-admin users", async () => {
    const { user } = await createRealUser("admin-jobs-update-forbidden");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .put(`/admin/jobs/${validId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 404 when the job does not exist", async () => {
    const { user: admin } = await createRealUser("admin-jobs-update-missing", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .put("/admin/jobs/550e8400-e29b-41d4-a716-446655440099")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Updated Backend Engineer",
        description: "Updated backend engineering role.",
        requirements: "Updated backend engineering requirements.",
      });

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe(
      "Lowongan pekerjaan tidak ditemukan"
    );
  });

  it("accepts an empty contact phone and normalizes it to null", async () => {
    const updateMock = jest.mocked(AdminJobService.update);
    updateMock.mockResolvedValue({
      id: validId,
      title: "Updated Backend Engineer",
    } as never);

    const response = await request(app)
      .put(`/admin/jobs/${validId}`)
      .set("Authorization", "Bearer admin-token")
      .send({
        title: "Updated Backend Engineer",
        description: "Updated backend engineering role.",
        requirements: "Updated backend engineering requirements.",
        contact_phone: "",
      });

    expect(response.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith(
      validId,
      expect.objectContaining({
        contact_phone: null,
      })
    );
  });
});
