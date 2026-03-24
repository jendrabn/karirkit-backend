import request from "supertest";

jest.mock("../../src/services/admin/job.service", () => ({
  AdminJobService: {
    update: jest.fn(),
  },
}));

import app from "../../src/index";
import { AdminJobService } from "../../src/services/admin/job.service";

describe("PUT /admin/jobs/:id", () => {
  const updateMock = jest.mocked(AdminJobService.update);
  const validId = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("updates an admin job", async () => {
    updateMock.mockResolvedValue({
      id: validId,
      title: "Updated Backend Engineer",
    } as never);

    const response = await request(app)
      .put(`/admin/jobs/${validId}`)
      .set("Authorization", "Bearer admin-token")
      .send({
        title: "Updated Backend Engineer",
        description: "Updated backend engineering role.",
        requirements: "Updated backend engineering requirements.",
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: validId,
      title: "Updated Backend Engineer",
    });
  });

  it("returns 403 for non-admin users", async () => {
    const response = await request(app)
      .put(`/admin/jobs/${validId}`)
      .set("Authorization", "Bearer user-token")
      .send({});

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the update payload is invalid", async () => {
    const response = await request(app)
      .put(`/admin/jobs/${validId}`)
      .set("Authorization", "Bearer admin-token")
      .send({
        title: "No",
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.title");
    expect(Array.isArray(response.body.errors.title)).toBe(true);
  });
});
