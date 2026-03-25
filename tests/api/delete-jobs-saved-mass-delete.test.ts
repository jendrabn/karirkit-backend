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
        massDeleteSavedJobs: jest.fn(),
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

describe("DELETE /jobs/saved/mass-delete", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  const validId = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deletes multiple saved jobs", async () => {
    const massDeleteSavedJobsMock = jest.mocked(JobService.massDeleteSavedJobs);
    massDeleteSavedJobsMock.mockResolvedValue({
      deleted_count: 1,
      ids: [validId],
    } as never);

    const response = await request(app)
      .delete("/jobs/saved/mass-delete")
      .set("Authorization", "Bearer user-token")
      .send({ ids: [validId] });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      deleted_count: 1,
      ids: [validId],
    });
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).delete("/jobs/saved/mass-delete").send({ ids: [validId] });

    expect(response.status).toBe(401);
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 400 when the ids payload is empty", async () => {
    const response = await request(app)
      .delete("/jobs/saved/mass-delete")
      .set("Authorization", "Bearer user-token")
      .send({ ids: [] });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.ids");
    expect(Array.isArray(response.body.errors.ids)).toBe(true);
  });
});

describe("DELETE /jobs/saved/mass-delete", () => {
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

  it("deletes multiple saved jobs", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("jobs-saved-mass-delete");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const fixtureOne = await createPublishedJobFixture("jobs-saved-mass-delete-1");
    const fixtureTwo = await createPublishedJobFixture("jobs-saved-mass-delete-2");
    fixtures.push(fixtureOne, fixtureTwo);

    await prisma.savedJob.createMany({
      data: [
        { userId: user.id, jobId: fixtureOne.job.id },
        { userId: user.id, jobId: fixtureTwo.job.id },
      ],
    });

    const response = await request(app)
      .delete("/jobs/saved/mass-delete")
      .set("Authorization", `Bearer ${token}`)
      .send({ ids: [fixtureOne.job.id, fixtureTwo.job.id] });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data.deleted_count).toBe(2);
    expect(response.body.data.message).toBe(
      "2 pekerjaan tersimpan berhasil dihapus",
    );

    const remaining = await prisma.savedJob.count({
      where: {
        userId: user.id,
      },
    });
    expect(remaining).toBe(0);
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app)
      .delete("/jobs/saved/mass-delete")
      .send({ ids: ["550e8400-e29b-41d4-a716-446655440000"] });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 400 when the ids payload is empty", async () => {
    const { user } = await createRealUser("jobs-saved-mass-delete-empty");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .delete("/jobs/saved/mass-delete")
      .set("Authorization", `Bearer ${token}`)
      .send({ ids: [] });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.ids");
    expect(Array.isArray(response.body.errors.ids)).toBe(true);
  });
});
