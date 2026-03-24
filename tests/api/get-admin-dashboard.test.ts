import request from "supertest";

jest.mock("../../src/services/admin/dashboard.service", () => ({
  DashboardService: {
    getStats: jest.fn(),
  },
}));

import app from "../../src/index";
import { DashboardService } from "../../src/services/admin/dashboard.service";

describe("GET /admin/dashboard", () => {
  const getStatsMock = jest.mocked(DashboardService.getStats);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns dashboard statistics for admin users", async () => {
    getStatsMock.mockResolvedValue({
      total_users: 12,
      total_jobs: 5,
    } as never);

    const response = await request(app)
      .get("/admin/dashboard")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      total_users: 12,
      total_jobs: 5,
    });
  });

  it("returns 403 for non-admin users", async () => {
    const response = await request(app)
      .get("/admin/dashboard")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 401 when no session is provided", async () => {
    const response = await request(app).get("/admin/dashboard");

    expect(response.status).toBe(401);
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });
});
