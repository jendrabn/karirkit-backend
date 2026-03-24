import request from "supertest";

jest.mock("../../src/services/admin/job-role.service", () => ({
  AdminJobRoleService: {
    update: jest.fn(),
  },
}));

import app from "../../src/index";
import { AdminJobRoleService } from "../../src/services/admin/job-role.service";

describe("PUT /admin/job-roles/:id", () => {
  const updateMock = jest.mocked(AdminJobRoleService.update);
  const validId = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("updates a job role for admin users", async () => {
    updateMock.mockResolvedValue({
      id: validId,
      name: "Updated Backend Engineer",
    } as never);

    const response = await request(app)
      .put(`/admin/job-roles/${validId}`)
      .set("Authorization", "Bearer admin-token")
      .send({
        name: "Updated Backend Engineer",
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: validId,
      name: "Updated Backend Engineer",
    });
  });

  it("returns 403 for non-admin users", async () => {
    const response = await request(app)
      .put(`/admin/job-roles/${validId}`)
      .set("Authorization", "Bearer user-token")
      .send({});

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the job role update payload is invalid", async () => {
    const response = await request(app)
      .put(`/admin/job-roles/${validId}`)
      .set("Authorization", "Bearer admin-token")
      .send({
        name: "AB",
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.name");
    expect(Array.isArray(response.body.errors.name)).toBe(true);
  });
});
