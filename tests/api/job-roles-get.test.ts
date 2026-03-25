import request from "supertest";
import {
  cleanupPublishedJobFixture,
  createPublishedJobFixture,
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
        listJobRoles: jest.fn(),
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

describe("GET /job-roles", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns public job role options", async () => {
    const listJobRolesMock = jest.mocked(JobService.listJobRoles);
    listJobRolesMock.mockResolvedValue([
      { id: "role-1", name: "Backend Engineer" },
    ] as never);

    const response = await request(app).get("/job-roles");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data[0]).toMatchObject({
      id: "role-1",
      name: "Backend Engineer",
    });
  });

  it("returns service errors when job roles cannot be loaded", async () => {
    const listJobRolesMock = jest.mocked(JobService.listJobRoles);
    listJobRolesMock.mockRejectedValue(
      new ResponseErrorClass(500, "Daftar job role gagal dimuat"),
    );

    const response = await request(app).get("/job-roles");

    expect(response.status).toBe(500);
    expect(response.body.errors.general[0]).toBe(
      "Daftar job role gagal dimuat",
    );
  });

  it("supports an empty job role option list", async () => {
    const listJobRolesMock = jest.mocked(JobService.listJobRoles);
    listJobRolesMock.mockResolvedValue([] as never);

    const response = await request(app).get("/job-roles");

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
  });
});

describe("GET /job-roles", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const fixtures: Array<Awaited<ReturnType<typeof createPublishedJobFixture>>> =
    [];
  const trackedJobRoleIds = new Set<string>();

  afterEach(async () => {
    const prisma = await loadPrisma();
    if (trackedJobRoleIds.size > 0) {
      await prisma.jobRole.deleteMany({
        where: {
          id: { in: [...trackedJobRoleIds] },
        },
      });
    }
    trackedJobRoleIds.clear();

    for (const fixture of fixtures) {
      await cleanupPublishedJobFixture(fixture);
    }
    fixtures.length = 0;
  });

  it("returns public job role options with active job counts", async () => {
    const fixture = await createPublishedJobFixture("job-roles-public-list");
    fixtures.push(fixture);

    const response = await request(app).get("/job-roles");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);

    const jobRole = response.body.data.find(
      (item: { id: string }) => item.id === fixture.jobRole.id,
    );

    expect(jobRole).toMatchObject({
      id: fixture.jobRole.id,
      name: fixture.jobRole.name,
      slug: fixture.jobRole.slug,
    });
    expect(typeof jobRole.job_count).toBe("number");
    expect(jobRole.job_count).toBeGreaterThanOrEqual(1);
  });

  it("returns 500 when the job role lookup fails unexpectedly", async () => {
    const prisma = await loadPrisma();
    const spy = jest
      .spyOn(prisma.jobRole, "findMany")
      .mockRejectedValueOnce(new Error("Daftar job role gagal dimuat"));

    const response = await request(app).get("/job-roles");

    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe(
      "Daftar job role gagal dimuat",
    );

    spy.mockRestore();
  });

  it("includes job roles even when they do not have active published jobs", async () => {
    const prisma = await loadPrisma();
    const jobRole = await prisma.jobRole.create({
      data: {
        name: "No Jobs Role",
        slug: `no-jobs-role-${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedJobRoleIds.add(jobRole.id);

    const response = await request(app).get("/job-roles");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(
      response.body.data.some((item: { id: string }) => item.id === jobRole.id),
    ).toBe(true);

    const jobRoleResult = response.body.data.find(
      (item: { id: string }) => item.id === jobRole.id,
    );
    expect(jobRoleResult?.job_count).toBe(0);
  });
});
