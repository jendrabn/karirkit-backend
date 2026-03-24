import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/job.service", () => ({
  JobService: {
    getBySlug: jest.fn(),
  },
}));

import app from "../../src/index";
import { JobService } from "../../src/services/job.service";

describe("GET /jobs/:slug", () => {
  const getBySlugMock = jest.mocked(JobService.getBySlug);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a public job detail payload", async () => {
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
    getBySlugMock.mockRejectedValue(new ResponseError(404, "Lowongan tidak ditemukan"));

    const response = await request(app).get("/jobs/missing-job");

    expect(response.status).toBe(404);
    expect(response.body.errors.general[0]).toBe("Lowongan tidak ditemukan");
  });

  it("supports personalized responses for authenticated visitors", async () => {
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
