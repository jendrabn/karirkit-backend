import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/job.service", () => ({
  JobService: {
    listCompanies: jest.fn(),
  },
}));

import app from "../../src/index";
import { JobService } from "../../src/services/job.service";

describe("GET /companies", () => {
  const listCompaniesMock = jest.mocked(JobService.listCompanies);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns public company options", async () => {
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
    listCompaniesMock.mockRejectedValue(new ResponseError(500, "Daftar perusahaan gagal dimuat"));

    const response = await request(app).get("/companies");

    expect(response.status).toBe(500);
    expect(response.body.errors.general[0]).toBe("Daftar perusahaan gagal dimuat");
  });

  it("supports an empty company option list", async () => {
    listCompaniesMock.mockResolvedValue([] as never);

    const response = await request(app).get("/companies");

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
  });
});
