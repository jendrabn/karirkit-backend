import request from "supertest";
import {
  cleanupPublishedJobFixture,
  createPublishedJobFixture,
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
} from "./real-mode";

const validId = "550e8400-e29b-41d4-a716-446655440000";
let app: typeof import("../../src/index").default;
let AdminJobService: typeof import("../../src/services/admin/job.service").AdminJobService;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/admin/job.service", () => ({
      AdminJobService: {
        get: jest.fn(),
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

describe("GET /admin/jobs/:id", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a single admin job detail", async () => {
    const getMock = jest.mocked(AdminJobService.get);
    getMock.mockResolvedValue({
      id: validId,
      title: "Backend Engineer",
    } as never);

    const response = await request(app)
      .get(`/admin/jobs/${validId}`)
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: validId,
      title: "Backend Engineer",
    });
  });

  it("returns 403 for non-admin users", async () => {
    const response = await request(app)
      .get(`/admin/jobs/${validId}`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the job id is invalid", async () => {
    const response = await request(app)
      .get("/admin/jobs/invalid-id")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.id");
    expect(Array.isArray(response.body.errors.id)).toBe(true);
  });
});

describe("GET /admin/jobs/:id", () => {
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

  it("returns a single admin job detail", async () => {
    const { user: admin } = await createRealUser("admin-job-detail", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);
    const fixture = await createPublishedJobFixture("admin-job-detail");
    fixtures.push(fixture);

    const response = await request(app)
      .get(`/admin/jobs/${fixture.job.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: fixture.job.id,
      company_id: fixture.company.id,
      job_role_id: fixture.jobRole.id,
      city_id: fixture.city.id,
      title: fixture.job.title,
      slug: fixture.job.slug,
      status: "published",
    });
    expect(response.body.data).toHaveProperty("company");
    expect(response.body.data).toHaveProperty("job_role");
    expect(response.body.data).toHaveProperty("city");
  });

  it("returns 403 for non-admin users", async () => {
    const { user } = await createRealUser("admin-job-detail-forbidden");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .get(`/admin/jobs/${validId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the job id is invalid", async () => {
    const { user: admin } = await createRealUser("admin-job-detail-invalid", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .get("/admin/jobs/invalid-id")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.id");
    expect(Array.isArray(response.body.errors.id)).toBe(true);
  });
});
