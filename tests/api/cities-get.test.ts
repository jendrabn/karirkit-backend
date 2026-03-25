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
        listCities: jest.fn(),
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

describe("GET /cities", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns public city options", async () => {
    const listCitiesMock = jest.mocked(JobService.listCities);
    listCitiesMock.mockResolvedValue([
      { id: "3171", name: "Jakarta Selatan" },
    ] as never);

    const response = await request(app).get("/cities");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data[0]).toMatchObject({
      id: "3171",
      name: "Jakarta Selatan",
    });
  });

  it("returns service errors when cities cannot be loaded", async () => {
    const listCitiesMock = jest.mocked(JobService.listCities);
    listCitiesMock.mockRejectedValue(
      new ResponseErrorClass(500, "Daftar kota gagal dimuat"),
    );

    const response = await request(app).get("/cities");

    expect(response.status).toBe(500);
    expect(response.body.errors.general[0]).toBe("Daftar kota gagal dimuat");
  });

  it("passes the has_jobs and province_id filters to the service", async () => {
    const listCitiesMock = jest.mocked(JobService.listCities);
    listCitiesMock.mockResolvedValue([] as never);

    const response = await request(app).get(
      "/cities?has_jobs=false&province_id=31",
    );

    expect(response.status).toBe(200);
    expect(listCitiesMock).toHaveBeenCalledWith(false, "31");
    expect(response.body.data).toEqual([]);
  });
});

describe("GET /cities", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const fixtures: Array<Awaited<ReturnType<typeof createPublishedJobFixture>>> =
    [];
  const trackedCityIds = new Set<string>();
  const trackedProvinceIds = new Set<string>();

  afterEach(async () => {
    const prisma = await loadPrisma();
    if (trackedCityIds.size > 0) {
      await prisma.city.deleteMany({
        where: {
          id: { in: [...trackedCityIds] },
        },
      });
    }
    if (trackedProvinceIds.size > 0) {
      await prisma.province.deleteMany({
        where: {
          id: { in: [...trackedProvinceIds] },
        },
      });
    }
    trackedCityIds.clear();
    trackedProvinceIds.clear();

    for (const fixture of fixtures) {
      await cleanupPublishedJobFixture(fixture);
    }
    fixtures.length = 0;
  });

  it("returns public city options with active job counts", async () => {
    const fixture = await createPublishedJobFixture("cities-public-list");
    fixtures.push(fixture);

    const response = await request(app).get("/cities");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);

    const city = response.body.data.find(
      (item: { id: string }) => item.id === fixture.city.id,
    );

    expect(city).toMatchObject({
      id: fixture.city.id,
      name: fixture.city.name,
      province_id: fixture.province.id,
    });
    expect(typeof city.job_count).toBe("number");
    expect(city.job_count).toBeGreaterThanOrEqual(1);
    expect(city).toHaveProperty("province");
  });

  it("returns 500 when the city lookup fails unexpectedly", async () => {
    const prisma = await loadPrisma();
    const spy = jest
      .spyOn(prisma.city, "findMany")
      .mockRejectedValueOnce(new Error("Daftar kota gagal dimuat"));

    const response = await request(app).get("/cities");

    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Daftar kota gagal dimuat");

    spy.mockRestore();
  });

  it("returns province-filtered cities when has_jobs is false", async () => {
    const prisma = await loadPrisma();
    const province = await prisma.province.create({
      data: {
        name: `Provinsi Tanpa Job ${Date.now()}`,
      },
    });
    trackedProvinceIds.add(province.id);

    const city = await prisma.city.create({
      data: {
        provinceId: province.id,
        name: `Kota Tanpa Job ${Date.now()}`,
      },
    });
    trackedCityIds.add(city.id);

    const response = await request(app).get(
      `/cities?has_jobs=false&province_id=${province.id}`,
    );

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);

    const matchedCity = response.body.data.find(
      (item: { id: string }) => item.id === city.id,
    );

    expect(matchedCity).toMatchObject({
      id: city.id,
      name: city.name,
      province_id: province.id,
      job_count: 0,
    });
  });
});
