import request from "supertest";

jest.mock("../../src/services/admin/job.service", () => ({
  AdminJobService: {
    list: jest.fn(),
  },
}));

import app from "../../src/index";
import { AdminJobService } from "../../src/services/admin/job.service";

describe("GET /admin/jobs", () => {
  const listMock = jest.mocked(AdminJobService.list);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns admin job listings", async () => {
    listMock.mockResolvedValue({
      items: [{ id: "job-1", title: "Backend Engineer" }],
      meta: { page: 1, per_page: 20, total: 1 },
    } as never);

    const response = await request(app)
      .get("/admin/jobs?page=1&per_page=20")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body.data.items[0]).toMatchObject({
      id: "job-1",
      title: "Backend Engineer",
    });
  });

  it("returns 403 for non-admin users", async () => {
    const response = await request(app)
      .get("/admin/jobs")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the salary range query is invalid", async () => {
    const response = await request(app)
      .get("/admin/jobs?salary_from=100&salary_to=10")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.salary_from");
    expect(Array.isArray(response.body.errors.salary_from)).toBe(true);
  });
});
