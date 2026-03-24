import request from "supertest";

jest.mock("../../src/services/admin/job.service", () => ({
  AdminJobService: {
    delete: jest.fn(),
  },
}));

import app from "../../src/index";
import { AdminJobService } from "../../src/services/admin/job.service";

describe("DELETE /admin/jobs/:id", () => {
  const deleteMock = jest.mocked(AdminJobService.delete);
  const validId = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deletes an admin job", async () => {
    deleteMock.mockResolvedValue(undefined as never);

    const response = await request(app)
      .delete(`/admin/jobs/${validId}`)
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
  });

  it("returns 403 for non-admin users", async () => {
    const response = await request(app)
      .delete(`/admin/jobs/${validId}`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the job id is invalid", async () => {
    const response = await request(app)
      .delete("/admin/jobs/invalid-id")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.id");
    expect(Array.isArray(response.body.errors.id)).toBe(true);
  });
});
