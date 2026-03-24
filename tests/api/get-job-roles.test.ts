import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/job.service", () => ({
  JobService: {
    listJobRoles: jest.fn(),
  },
}));

import app from "../../src/index";
import { JobService } from "../../src/services/job.service";

describe("GET /job-roles", () => {
  const listJobRolesMock = jest.mocked(JobService.listJobRoles);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns public job role options", async () => {
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
    listJobRolesMock.mockRejectedValue(new ResponseError(500, "Daftar job role gagal dimuat"));

    const response = await request(app).get("/job-roles");

    expect(response.status).toBe(500);
    expect(response.body.errors.general[0]).toBe("Daftar job role gagal dimuat");
  });

  it("supports an empty job role option list", async () => {
    listJobRolesMock.mockResolvedValue([] as never);

    const response = await request(app).get("/job-roles");

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
  });
});
