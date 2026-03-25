import request from "supertest";
import {
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
  loadPrisma,
} from "./real-mode";

let app: typeof import("../../src/index").default;
let AdminJobRoleService: typeof import("../../src/services/admin/job-role.service").AdminJobRoleService;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/admin/job-role.service", () => ({
      AdminJobRoleService: {
        list: jest.fn(),
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

describe("GET /admin/job-roles", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns admin job role listings", async () => {
    const listMock = jest.mocked(AdminJobRoleService.list);
    listMock.mockResolvedValue({
      items: [{ id: "role-1", name: "Backend Engineer" }],
      meta: { page: 1, per_page: 20, total: 1 },
    } as never);

    const response = await request(app)
      .get("/admin/job-roles")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body.data.items[0]).toMatchObject({
      id: "role-1",
      name: "Backend Engineer",
    });
  });

  it("returns 403 for non-admin users", async () => {
    const response = await request(app)
      .get("/admin/job-roles")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the job role range query is invalid", async () => {
    const response = await request(app)
      .get("/admin/job-roles?job_count_from=10&job_count_to=5")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.job_count_from");
    expect(Array.isArray(response.body.errors.job_count_from)).toBe(true);
  });
});

describe("GET /admin/job-roles", () => {
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

  it("returns admin job role listings", async () => {
    const prisma = await loadPrisma();
    const { user: admin } = await createRealUser("admin-job-roles-list", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);

    const first = await prisma.jobRole.create({
      data: {
        name: "Backend Engineer",
        slug: "backend-engineer-real-list",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const second = await prisma.jobRole.create({
      data: {
        name: "Frontend Engineer",
        slug: "frontend-engineer-real-list",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedRoleIds.add(first.id);
    trackedRoleIds.add(second.id);

    const response = await request(app)
      .get("/admin/job-roles?sort_by=name&sort_order=asc")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body).toHaveProperty("data.pagination");
    expect(response.body.data.items.length).toBeGreaterThanOrEqual(2);
    expect(response.body.data.items[0]).toHaveProperty("name");
    expect(response.body.data.pagination.total_items).toBeGreaterThanOrEqual(2);
  });

  it("returns 403 for non-admin users", async () => {
    const { user } = await createRealUser("admin-job-roles-list-forbidden");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .get("/admin/job-roles")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the job role range query is invalid", async () => {
    const { user: admin } = await createRealUser("admin-job-roles-list-invalid", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .get("/admin/job-roles?job_count_from=10&job_count_to=5")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.job_count_from");
    expect(Array.isArray(response.body.errors.job_count_from)).toBe(true);
  });
});
