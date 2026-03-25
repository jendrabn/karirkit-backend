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
        listSavedJobs: jest.fn(),
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

describe("GET /jobs/saved", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns saved jobs for authenticated users", async () => {
    const listSavedJobsMock = jest.mocked(JobService.listSavedJobs);
    listSavedJobsMock.mockResolvedValue({
      items: [{ id: "saved-1", slug: "backend-engineer" }],
      meta: { page: 1, per_page: 10, total: 1 },
    } as never);

    const response = await request(app)
      .get("/jobs/saved?page=1&per_page=10")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body.data.items[0]).toMatchObject({
      id: "saved-1",
      slug: "backend-engineer",
    });
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).get("/jobs/saved");

    expect(response.status).toBe(401);
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 400 when the query is invalid", async () => {
    const response = await request(app)
      .get("/jobs/saved?per_page=0")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.per_page");
    expect(Array.isArray(response.body.errors.per_page)).toBe(true);
  });
});

describe("GET /jobs/saved", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();
  const fixtures: Array<Awaited<ReturnType<typeof createPublishedJobFixture>>> = [];

  afterEach(async () => {
    for (const fixture of fixtures) {
      await cleanupPublishedJobFixture(fixture);
    }
    fixtures.length = 0;
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("returns saved jobs for authenticated users", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("jobs-saved-list");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const fixture = await createPublishedJobFixture("jobs-saved-list");
    fixtures.push(fixture);

    await prisma.savedJob.create({
      data: {
        userId: user.id,
        jobId: fixture.job.id,
      },
    });

    const response = await request(app)
      .get("/jobs/saved?page=1&per_page=10")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body).toHaveProperty("data.pagination");
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0]).toMatchObject({
      id: fixture.job.id,
      slug: fixture.job.slug,
      is_saved: true,
    });
    expect(response.body.data.items[0]).toHaveProperty("company");
    expect(response.body.data.items[0]).toHaveProperty("job_role");
    expect(response.body.data.pagination.total_items).toBe(1);
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).get("/jobs/saved");

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 400 when the query is invalid", async () => {
    const { user } = await createRealUser("jobs-saved-invalid-query");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .get("/jobs/saved?per_page=0")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.per_page");
    expect(Array.isArray(response.body.errors.per_page)).toBe(true);
  });
});
