import request from "supertest";

jest.mock("../../src/services/admin/job-role.service", () => ({
  AdminJobRoleService: {
    delete: jest.fn(),
  },
}));

import app from "../../src/index";
import { AdminJobRoleService } from "../../src/services/admin/job-role.service";

describe("DELETE /admin/job-roles/:id", () => {
  const deleteMock = jest.mocked(AdminJobRoleService.delete);
  const validId = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deletes a job role for admin users", async () => {
    deleteMock.mockResolvedValue(undefined as never);

    const response = await request(app)
      .delete(`/admin/job-roles/${validId}`)
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
  });

  it("returns 403 for non-admin users", async () => {
    const response = await request(app)
      .delete(`/admin/job-roles/${validId}`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the job role id is invalid", async () => {
    const response = await request(app)
      .delete("/admin/job-roles/invalid-id")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.id");
    expect(Array.isArray(response.body.errors.id)).toBe(true);
  });
});
