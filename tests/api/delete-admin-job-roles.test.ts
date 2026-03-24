import request from "supertest";

jest.mock("../../src/services/admin/job-role.service", () => ({
  AdminJobRoleService: {
    massDelete: jest.fn(),
  },
}));

import app from "../../src/index";
import { AdminJobRoleService } from "../../src/services/admin/job-role.service";

describe("DELETE /admin/job-roles", () => {
  const massDeleteMock = jest.mocked(AdminJobRoleService.massDelete);
  const validId = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deletes multiple job roles", async () => {
    massDeleteMock.mockResolvedValue({
      deleted_count: 1,
      ids: [validId],
    } as never);

    const response = await request(app)
      .delete("/admin/job-roles")
      .set("Authorization", "Bearer admin-token")
      .send({ ids: [validId] });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      deleted_count: 1,
      ids: [validId],
    });
  });

  it("returns 403 for non-admin users", async () => {
    const response = await request(app)
      .delete("/admin/job-roles")
      .set("Authorization", "Bearer user-token")
      .send({ ids: [validId] });

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the ids payload is empty", async () => {
    const response = await request(app)
      .delete("/admin/job-roles")
      .set("Authorization", "Bearer admin-token")
      .send({ ids: [] });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.ids");
    expect(Array.isArray(response.body.errors.ids)).toBe(true);
  });
});
