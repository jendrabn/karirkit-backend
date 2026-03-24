import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/job.service", () => ({
  JobService: {
    listCities: jest.fn(),
  },
}));

import app from "../../src/index";
import { JobService } from "../../src/services/job.service";

describe("GET /cities", () => {
  const listCitiesMock = jest.mocked(JobService.listCities);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns public city options", async () => {
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
    listCitiesMock.mockRejectedValue(new ResponseError(500, "Daftar kota gagal dimuat"));

    const response = await request(app).get("/cities");

    expect(response.status).toBe(500);
    expect(response.body.errors.general[0]).toBe("Daftar kota gagal dimuat");
  });

  it("passes the has_jobs and province_id filters to the service", async () => {
    listCitiesMock.mockResolvedValue([] as never);

    const response = await request(app).get("/cities?has_jobs=false&province_id=31");

    expect(response.status).toBe(200);
    expect(listCitiesMock).toHaveBeenCalledWith(false, "31");
    expect(response.body.data).toEqual([]);
  });
});
