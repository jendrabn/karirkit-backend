import request from "supertest";
import {
  cleanupPublishedJobFixture,
  createPublishedJobFixture,
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
  loadPrisma,
} from "./real-mode";

let app: typeof import("../../src/index").default;
let JobService: typeof import("../../src/services/job.service").JobService;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/job.service", () => ({
      JobService: {
        list: jest.fn(),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ JobService } = await import("../../src/services/job.service"));
});

afterAll(async () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    await disconnectPrisma();
  }
});

describe("GET /jobs", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a paginated public job list", async () => {
    const listMock = jest.mocked(JobService.list);
    listMock.mockResolvedValue({
      items: [{ slug: "backend-engineer", title: "Backend Engineer" }],
      pagination: { page: 1, per_page: 5, total_items: 1, total_pages: 1 },
    } as never);

    const response = await request(app).get("/jobs?page=1&per_page=5");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body).toHaveProperty("data.pagination");
    expect(response.body.data.items[0]).toMatchObject({
      slug: "backend-engineer",
      title: "Backend Engineer",
    });
    expect(response.body.data.pagination.total_items).toBe(1);
  });

  it("returns 400 when the query is invalid", async () => {
    const response = await request(app).get("/jobs?page=0");

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.page");
    expect(Array.isArray(response.body.errors.page)).toBe(true);
  });

  it("passes the authenticated user id to optional-auth listings", async () => {
    const listMock = jest.mocked(JobService.list);
    listMock.mockResolvedValue({
      items: [
        { slug: "backend-engineer", title: "Backend Engineer", is_saved: true },
      ],
      pagination: { page: 1, per_page: 20, total_items: 1, total_pages: 1 },
    } as never);

    const response = await request(app)
      .get("/jobs")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(200);
    expect(response.body.data.items[0].is_saved).toBe(true);
    expect(listMock).toHaveBeenCalledWith(expect.any(Object), "user-1");
  });
});

describe("GET /jobs", () => {
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

  it("returns a paginated public job list", async () => {
    const fixture = await createPublishedJobFixture("jobs-public-list");
    fixtures.push(fixture);

    const response = await request(app).get(
      `/jobs?page=1&per_page=10&company_id=${fixture.company.id}&job_type=full_time`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body).toHaveProperty("data.pagination");
    expect(Array.isArray(response.body.data.items)).toBe(true);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0]).toMatchObject({
      id: fixture.job.id,
      company_id: fixture.company.id,
      job_role_id: fixture.jobRole.id,
      city_id: fixture.city.id,
      slug: fixture.job.slug,
      title: fixture.job.title,
      status: "published",
      is_saved: false,
    });
    expect(response.body.data.items[0]).toHaveProperty("company");
    expect(response.body.data.items[0]).toHaveProperty("job_role");
    expect(response.body.data.items[0]).toHaveProperty("city");
    expect(response.body.data.pagination).toMatchObject({
      page: 1,
      per_page: 10,
      total_items: 1,
      total_pages: 1,
    });
  });

  it("returns 400 when the query is invalid", async () => {
    const response = await request(app).get("/jobs?page=0");

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.page");
    expect(Array.isArray(response.body.errors.page)).toBe(true);
  });

  it("marks saved jobs for authenticated visitors", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("jobs-public-saved");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const fixture = await createPublishedJobFixture("jobs-public-saved");
    fixtures.push(fixture);

    await prisma.savedJob.create({
      data: {
        userId: user.id,
        jobId: fixture.job.id,
      },
    });

    const response = await request(app)
      .get(`/jobs?company_id=${fixture.company.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0]).toMatchObject({
      id: fixture.job.id,
      is_saved: true,
    });
  });
});
