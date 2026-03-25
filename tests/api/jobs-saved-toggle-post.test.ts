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
        toggleSavedJob: jest.fn(),
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

describe("POST /jobs/saved/toggle", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  const validId = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("toggles a saved job for the authenticated user", async () => {
    const toggleSavedJobMock = jest.mocked(JobService.toggleSavedJob);
    toggleSavedJobMock.mockResolvedValue({
      id: validId,
      saved: true,
    } as never);

    const response = await request(app)
      .post("/jobs/saved/toggle")
      .set("Authorization", "Bearer user-token")
      .send({ id: validId });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: validId,
      saved: true,
    });
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).post("/jobs/saved/toggle").send({ id: validId });

    expect(response.status).toBe(401);
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 400 when the job id is not a valid UUID", async () => {
    const response = await request(app)
      .post("/jobs/saved/toggle")
      .set("Authorization", "Bearer user-token")
      .send({ id: "invalid-id" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.id");
    expect(Array.isArray(response.body.errors.id)).toBe(true);
  });
});

describe("POST /jobs/saved/toggle", () => {
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

  it("toggles a saved job for the authenticated user", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("jobs-saved-toggle");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const fixture = await createPublishedJobFixture("jobs-saved-toggle");
    fixtures.push(fixture);

    const response = await request(app)
      .post("/jobs/saved/toggle")
      .set("Authorization", `Bearer ${token}`)
      .send({ id: fixture.job.id });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: fixture.job.id,
      slug: fixture.job.slug,
      is_saved: true,
    });

    const saved = await prisma.savedJob.findUnique({
      where: {
        userId_jobId: {
          userId: user.id,
          jobId: fixture.job.id,
        },
      },
    });
    expect(saved).not.toBeNull();
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const fixture = await createPublishedJobFixture("jobs-saved-toggle-noauth");
    fixtures.push(fixture);

    const response = await request(app)
      .post("/jobs/saved/toggle")
      .send({ id: fixture.job.id });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("removes the saved job when the same job is toggled again", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("jobs-saved-toggle-remove");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const fixture = await createPublishedJobFixture("jobs-saved-toggle-remove");
    fixtures.push(fixture);

    await prisma.savedJob.create({
      data: {
        userId: user.id,
        jobId: fixture.job.id,
      },
    });

    const response = await request(app)
      .post("/jobs/saved/toggle")
      .set("Authorization", `Bearer ${token}`)
      .send({ id: fixture.job.id });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: fixture.job.id,
      is_saved: false,
    });

    const saved = await prisma.savedJob.findUnique({
      where: {
        userId_jobId: {
          userId: user.id,
          jobId: fixture.job.id,
        },
      },
    });
    expect(saved).toBeNull();
  });
});
