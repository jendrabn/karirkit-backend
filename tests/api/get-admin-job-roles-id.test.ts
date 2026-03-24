import request from "supertest";

jest.mock("../../src/services/admin/job-role.service", () => ({
  AdminJobRoleService: {
    get: jest.fn(),
  },
}));

import app from "../../src/index";
import { AdminJobRoleService } from "../../src/services/admin/job-role.service";

describe("GET /admin/job-roles/:id", () => {
  const getMock = jest.mocked(AdminJobRoleService.get);
  const validId = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a single job role detail", async () => {
    getMock.mockResolvedValue({
      id: validId,
      name: "Backend Engineer",
    } as never);

    const response = await request(app)
      .get(`/admin/job-roles/${validId}`)
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: validId,
      name: "Backend Engineer",
    });
  });

  it("returns 403 for non-admin users", async () => {
    const response = await request(app)
      .get(`/admin/job-roles/${validId}`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the job role id is invalid", async () => {
    const response = await request(app)
      .get("/admin/job-roles/invalid-id")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.id");
    expect(Array.isArray(response.body.errors.id)).toBe(true);
  });
});
