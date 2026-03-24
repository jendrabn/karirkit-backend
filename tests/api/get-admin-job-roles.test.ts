import request from "supertest";

jest.mock("../../src/services/admin/job-role.service", () => ({
  AdminJobRoleService: {
    list: jest.fn(),
  },
}));

import app from "../../src/index";
import { AdminJobRoleService } from "../../src/services/admin/job-role.service";

describe("GET /admin/job-roles", () => {
  const listMock = jest.mocked(AdminJobRoleService.list);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns admin job role listings", async () => {
    listMock.mockResolvedValue({
      items: [{ id: "role-1", name: "Backend Engineer" }],
      meta: { page: 1, per_page: 20, total: 1 },
    } as never);

    const response = await request(app)
      .get("/admin/job-roles")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body.data.items[0]).toMatchObject({
      id: "role-1",
      name: "Backend Engineer",
    });
  });

  it("returns 403 for non-admin users", async () => {
    const response = await request(app)
      .get("/admin/job-roles")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the job role range query is invalid", async () => {
    const response = await request(app)
      .get("/admin/job-roles?job_count_from=10&job_count_to=5")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.job_count_from");
    expect(Array.isArray(response.body.errors.job_count_from)).toBe(true);
  });
});
