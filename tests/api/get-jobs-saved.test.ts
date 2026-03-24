import request from "supertest";

jest.mock("../../src/services/job.service", () => ({
  JobService: {
    listSavedJobs: jest.fn(),
  },
}));

import app from "../../src/index";
import { JobService } from "../../src/services/job.service";

describe("GET /jobs/saved", () => {
  const listSavedJobsMock = jest.mocked(JobService.listSavedJobs);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns saved jobs for authenticated users", async () => {
    listSavedJobsMock.mockResolvedValue({
      items: [{ id: "saved-1", slug: "backend-engineer" }],
      meta: { page: 1, per_page: 10, total: 1 },
    } as never);

    const response = await request(app)
      .get("/jobs/saved?page=1&per_page=10")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body.data.items[0]).toMatchObject({
      id: "saved-1",
      slug: "backend-engineer",
    });
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).get("/jobs/saved");

    expect(response.status).toBe(401);
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 400 when the query is invalid", async () => {
    const response = await request(app)
      .get("/jobs/saved?per_page=0")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.per_page");
    expect(Array.isArray(response.body.errors.per_page)).toBe(true);
  });
});
