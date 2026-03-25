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
        get: jest.fn(),
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

describe("GET /admin/job-roles/:id", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a single job role detail", async () => {
    const getMock = jest.mocked(AdminJobRoleService.get);
    getMock.mockResolvedValue({
      id: validId,
      name: "Backend Engineer",
      slug: "backend-engineer",
      job_count: 0,
    } as never);

    const response = await request(app)
      .get(`/admin/job-roles/${validId}`)
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: validId,
      name: "Backend Engineer",
      slug: "backend-engineer",
      job_count: 0,
    });
    expect(typeof response.body.data.name).toBe("string");
  });

  it("returns 403 for non-admin users", async () => {
    const response = await request(app)
      .get(`/admin/job-roles/${validId}`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the job role id is invalid", async () => {
    const response = await request(app)
      .get("/admin/job-roles/invalid-id")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.id");
    expect(Array.isArray(response.body.errors.id)).toBe(true);
  });
});

describe("GET /admin/job-roles/:id", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();
  const trackedRoleIds = new Set<string>();

  afterEach(async () => {
    const prisma = await loadPrisma();
    if (trackedRoleIds.size > 0) {
      await prisma.jobRole.deleteMany({
        where: { id: { in: [...trackedRoleIds] } },
      });
    }
    trackedRoleIds.clear();
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("returns a single job role detail", async () => {
    const prisma = await loadPrisma();
    const { user: admin } = await createRealUser("admin-job-role-get", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);
    const suffix = Date.now();
    const jobRole = await prisma.jobRole.create({
      data: {
        name: `Backend Engineer ${suffix}`,
        slug: `backend-engineer-${suffix}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedRoleIds.add(jobRole.id);

    const response = await request(app)
      .get(`/admin/job-roles/${jobRole.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: jobRole.id,
      name: jobRole.name,
      slug: jobRole.slug,
      job_count: 0,
    });
  });

  it("returns 403 for non-admin users", async () => {
    const { user } = await createRealUser("admin-job-role-get-forbidden");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .get(`/admin/job-roles/${validId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the job role id is invalid", async () => {
    const { user: admin } = await createRealUser("admin-job-role-get-invalid", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .get("/admin/job-roles/invalid-id")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.id");
    expect(Array.isArray(response.body.errors.id)).toBe(true);
  });
});
