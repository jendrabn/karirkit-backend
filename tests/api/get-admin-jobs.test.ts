import request from "supertest";
import {
  cleanupPublishedJobFixture,
  createPublishedJobFixture,
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
} from "./real-mode";

let app: typeof import("../../src/index").default;
let AdminJobService: typeof import("../../src/services/admin/job.service").AdminJobService;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/admin/job.service", () => ({
      AdminJobService: {
        list: jest.fn(),
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

describe("GET /admin/jobs", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns admin job listings", async () => {
    const listMock = jest.mocked(AdminJobService.list);
    listMock.mockResolvedValue({
      items: [{ id: "job-1", title: "Backend Engineer" }],
      pagination: { page: 1, per_page: 20, total_items: 1, total_pages: 1 },
    } as never);

    const response = await request(app)
      .get("/admin/jobs?page=1&per_page=20")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body).toHaveProperty("data.pagination");
    expect(response.body.data.items[0]).toMatchObject({
      id: "job-1",
      title: "Backend Engineer",
    });
  });

  it("returns 403 for non-admin users", async () => {
    const response = await request(app)
      .get("/admin/jobs")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the salary range query is invalid", async () => {
    const response = await request(app)
      .get("/admin/jobs?salary_from=100&salary_to=10")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.salary_from");
    expect(Array.isArray(response.body.errors.salary_from)).toBe(true);
  });
});

describe("GET /admin/jobs", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();
  const fixtures: Array<Awaited<ReturnType<typeof createPublishedJobFixture>>> =
    [];

  afterEach(async () => {
    for (const fixture of fixtures) {
      await cleanupPublishedJobFixture(fixture);
    }
    fixtures.length = 0;
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("returns admin job listings", async () => {
    const { user: admin } = await createRealUser("admin-jobs-list", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);
    const fixture = await createPublishedJobFixture("admin-jobs-list");
    fixtures.push(fixture);

    const response = await request(app)
      .get(
        `/admin/jobs?page=1&per_page=20&company_id=${fixture.company.id}&sort_by=created_at&sort_order=desc`,
      )
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body).toHaveProperty("data.pagination");
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0]).toMatchObject({
      id: fixture.job.id,
      company_id: fixture.company.id,
      job_role_id: fixture.jobRole.id,
      title: fixture.job.title,
      status: "published",
    });
    expect(response.body.data.items[0]).toHaveProperty("company");
    expect(response.body.data.items[0]).toHaveProperty("job_role");
    expect(response.body.data.pagination.total_items).toBe(1);
  });

  it("returns 403 for non-admin users", async () => {
    const { user } = await createRealUser("admin-jobs-forbidden");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .get("/admin/jobs")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the salary range query is invalid", async () => {
    const { user: admin } = await createRealUser("admin-jobs-invalid-query", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .get("/admin/jobs?salary_from=100&salary_to=10")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.salary_from");
    expect(Array.isArray(response.body.errors.salary_from)).toBe(true);
  });
});
