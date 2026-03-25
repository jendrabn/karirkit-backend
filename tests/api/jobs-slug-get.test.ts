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
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/job.service", () => ({
      JobService: {
        getBySlug: jest.fn(),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ JobService } = await import("../../src/services/job.service"));
  ({ ResponseError: ResponseErrorClass } = await import(
    "../../src/utils/response-error.util"
  ));
});

afterAll(async () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    await disconnectPrisma();
  }
});

describe("GET /jobs/:slug", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a public job detail payload", async () => {
    const getBySlugMock = jest.mocked(JobService.getBySlug);
    getBySlugMock.mockResolvedValue({
      slug: "backend-engineer",
      title: "Backend Engineer",
    } as never);

    const response = await request(app).get("/jobs/backend-engineer");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      slug: "backend-engineer",
      title: "Backend Engineer",
    });
    expect(typeof response.body.slug).toBe("string");
  });

  it("returns 404 when the job cannot be found", async () => {
    const getBySlugMock = jest.mocked(JobService.getBySlug);
    getBySlugMock.mockRejectedValue(
      new ResponseErrorClass(404, "Lowongan tidak ditemukan"),
    );

    const response = await request(app).get("/jobs/missing-job");

    expect(response.status).toBe(404);
    expect(response.body.errors.general[0]).toBe("Lowongan tidak ditemukan");
  });

  it("supports personalized responses for authenticated visitors", async () => {
    const getBySlugMock = jest.mocked(JobService.getBySlug);
    getBySlugMock.mockResolvedValue({
      slug: "backend-engineer",
      title: "Backend Engineer",
      is_saved: true,
    } as never);

    const response = await request(app)
      .get("/jobs/backend-engineer")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(200);
    expect(response.body.is_saved).toBe(true);
    expect(getBySlugMock).toHaveBeenCalledWith("backend-engineer", "user-1");
  });
});

describe("GET /jobs/:slug", () => {
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

  it("returns a public job detail payload", async () => {
    const fixture = await createPublishedJobFixture("jobs-slug-detail");
    fixtures.push(fixture);

    const response = await request(app).get(`/jobs/${fixture.job.slug}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: fixture.job.id,
      company_id: fixture.company.id,
      job_role_id: fixture.jobRole.id,
      city_id: fixture.city.id,
      slug: fixture.job.slug,
      title: fixture.job.title,
      status: "published",
      is_saved: false,
    });
    expect(response.body).toHaveProperty("company");
    expect(response.body).toHaveProperty("job_role");
    expect(response.body).toHaveProperty("city");
  });

  it("returns 404 when the job cannot be found", async () => {
    const response = await request(app).get("/jobs/missing-job");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe(
      "Lowongan pekerjaan tidak ditemukan",
    );
  });

  it("supports personalized responses for authenticated visitors", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("jobs-slug-saved");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const fixture = await createPublishedJobFixture("jobs-slug-saved");
    fixtures.push(fixture);

    await prisma.savedJob.create({
      data: {
        userId: user.id,
        jobId: fixture.job.id,
      },
    });

    const response = await request(app)
      .get(`/jobs/${fixture.job.slug}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(fixture.job.id);
    expect(response.body.is_saved).toBe(true);
  });
});
