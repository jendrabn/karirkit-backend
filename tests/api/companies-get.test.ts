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
        listCompanies: jest.fn(),
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

describe("GET /companies", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns public company options", async () => {
    const listCompaniesMock = jest.mocked(JobService.listCompanies);
    listCompaniesMock.mockResolvedValue([
      { id: "company-1", name: "Acme" },
    ] as never);

    const response = await request(app).get("/companies");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data[0]).toMatchObject({
      id: "company-1",
      name: "Acme",
    });
  });

  it("returns service errors when companies cannot be loaded", async () => {
    const listCompaniesMock = jest.mocked(JobService.listCompanies);
    listCompaniesMock.mockRejectedValue(
      new ResponseErrorClass(500, "Daftar perusahaan gagal dimuat"),
    );

    const response = await request(app).get("/companies");

    expect(response.status).toBe(500);
    expect(response.body.errors.general[0]).toBe(
      "Daftar perusahaan gagal dimuat",
    );
  });

  it("supports an empty company option list", async () => {
    const listCompaniesMock = jest.mocked(JobService.listCompanies);
    listCompaniesMock.mockResolvedValue([] as never);

    const response = await request(app).get("/companies");

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
  });
});

describe("GET /companies", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const fixtures: Array<Awaited<ReturnType<typeof createPublishedJobFixture>>> =
    [];
  const trackedCompanyIds = new Set<string>();

  afterEach(async () => {
    const prisma = await loadPrisma();
    if (trackedCompanyIds.size > 0) {
      await prisma.company.deleteMany({
        where: {
          id: { in: [...trackedCompanyIds] },
        },
      });
    }
    trackedCompanyIds.clear();

    for (const fixture of fixtures) {
      await cleanupPublishedJobFixture(fixture);
    }
    fixtures.length = 0;
  });

  it("returns public company options with active job counts", async () => {
    const fixture = await createPublishedJobFixture("companies-public-list");
    fixtures.push(fixture);

    const response = await request(app).get("/companies");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);

    const company = response.body.data.find(
      (item: { id: string }) => item.id === fixture.company.id,
    );

    expect(company).toMatchObject({
      id: fixture.company.id,
      name: fixture.company.name,
      slug: fixture.company.slug,
    });
    expect(typeof company.job_count).toBe("number");
    expect(company.job_count).toBeGreaterThanOrEqual(1);
  });

  it("returns 500 when the company lookup fails unexpectedly", async () => {
    const prisma = await loadPrisma();
    const spy = jest
      .spyOn(prisma.company, "findMany")
      .mockRejectedValueOnce(new Error("Daftar perusahaan gagal dimuat"));

    const response = await request(app).get("/companies");

    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe(
      "Daftar perusahaan gagal dimuat",
    );

    spy.mockRestore();
  });

  it("excludes companies without active published jobs", async () => {
    const prisma = await loadPrisma();
    const company = await prisma.company.create({
      data: {
        name: "No Jobs Company",
        slug: `no-jobs-company-${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedCompanyIds.add(company.id);

    const response = await request(app).get("/companies");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(
      response.body.data.some((item: { id: string }) => item.id === company.id),
    ).toBe(false);
  });
});
