import request from "supertest";

jest.mock("../../src/services/job.service", () => ({
  JobService: {
    list: jest.fn(),
  },
}));

import app from "../../src/index";
import { JobService } from "../../src/services/job.service";

describe("GET /jobs", () => {
  const listMock = jest.mocked(JobService.list);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a paginated public job list", async () => {
    listMock.mockResolvedValue({
      items: [{ slug: "backend-engineer", title: "Backend Engineer" }],
      meta: { page: 1, per_page: 5, total: 1 },
    } as never);

    const response = await request(app).get("/jobs?page=1&per_page=5");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body.data.items[0]).toMatchObject({
      slug: "backend-engineer",
      title: "Backend Engineer",
    });
    expect(response.body.data.meta.total).toBe(1);
  });

  it("returns 400 when the query is invalid", async () => {
    const response = await request(app).get("/jobs?page=0");

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.page");
    expect(Array.isArray(response.body.errors.page)).toBe(true);
  });

  it("passes the authenticated user id to optional-auth listings", async () => {
    listMock.mockResolvedValue({
      items: [{ slug: "backend-engineer", title: "Backend Engineer", is_saved: true }],
      meta: { page: 1, per_page: 20, total: 1 },
    } as never);

    const response = await request(app)
      .get("/jobs")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(200);
    expect(response.body.data.items[0].is_saved).toBe(true);
    expect(listMock).toHaveBeenCalledWith(expect.any(Object), "user-1");
  });
});
