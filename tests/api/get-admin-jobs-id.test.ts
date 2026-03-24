import request from "supertest";

jest.mock("../../src/services/admin/job.service", () => ({
  AdminJobService: {
    get: jest.fn(),
  },
}));

import app from "../../src/index";
import { AdminJobService } from "../../src/services/admin/job.service";

describe("GET /admin/jobs/:id", () => {
  const getMock = jest.mocked(AdminJobService.get);
  const validId = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a single admin job detail", async () => {
    getMock.mockResolvedValue({
      id: validId,
      title: "Backend Engineer",
    } as never);

    const response = await request(app)
      .get(`/admin/jobs/${validId}`)
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: validId,
      title: "Backend Engineer",
    });
  });

  it("returns 403 for non-admin users", async () => {
    const response = await request(app)
      .get(`/admin/jobs/${validId}`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the job id is invalid", async () => {
    const response = await request(app)
      .get("/admin/jobs/invalid-id")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.id");
    expect(Array.isArray(response.body.errors.id)).toBe(true);
  });
});
