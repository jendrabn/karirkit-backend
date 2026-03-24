import request from "supertest";

jest.mock("../../src/services/admin/company.service", () => ({
  AdminCompanyService: {
    get: jest.fn(),
  },
}));

import app from "../../src/index";
import { AdminCompanyService } from "../../src/services/admin/company.service";

describe("GET /admin/companies/:id", () => {
  const getMock = jest.mocked(AdminCompanyService.get);
  const validId = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a single company detail", async () => {
    getMock.mockResolvedValue({
      id: validId,
      name: "Acme",
    } as never);

    const response = await request(app)
      .get(`/admin/companies/${validId}`)
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: validId,
      name: "Acme",
    });
  });

  it("returns 403 for non-admin users", async () => {
    const response = await request(app)
      .get(`/admin/companies/${validId}`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the company id is invalid", async () => {
    const response = await request(app)
      .get("/admin/companies/invalid-id")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.id");
    expect(Array.isArray(response.body.errors.id)).toBe(true);
  });
});
