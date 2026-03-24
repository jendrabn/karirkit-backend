import request from "supertest";

jest.mock("../../src/services/dashboard.service", () => ({
  DashboardService: {
    getUserStats: jest.fn(),
  },
}));

import app from "../../src/index";
import { DashboardService } from "../../src/services/dashboard.service";

describe("GET /dashboard", () => {
  const getUserStatsMock = jest.mocked(DashboardService.getUserStats);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns authenticated dashboard statistics", async () => {
    getUserStatsMock.mockResolvedValue({
      total_applications: 12,
      total_cvs: 3,
    } as never);

    const response = await request(app)
      .get("/dashboard")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      total_applications: 12,
      total_cvs: 3,
    });
    expect(typeof response.body.data.total_applications).toBe("number");
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).get("/dashboard");

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("supports empty dashboard data for new users", async () => {
    getUserStatsMock.mockResolvedValue({
      total_applications: 0,
      total_cvs: 0,
    } as never);

    const response = await request(app)
      .get("/dashboard")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(200);
    expect(response.body.data.total_applications).toBe(0);
    expect(response.body.data.total_cvs).toBe(0);
  });
});
