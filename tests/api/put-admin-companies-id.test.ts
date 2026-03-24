import request from "supertest";

jest.mock("../../src/services/admin/company.service", () => ({
  AdminCompanyService: {
    update: jest.fn(),
  },
}));

import app from "../../src/index";
import { AdminCompanyService } from "../../src/services/admin/company.service";

describe("PUT /admin/companies/:id", () => {
  const updateMock = jest.mocked(AdminCompanyService.update);
  const validId = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("updates a company for admin users", async () => {
    updateMock.mockResolvedValue({
      id: validId,
      name: "Updated Company",
    } as never);

    const response = await request(app)
      .put(`/admin/companies/${validId}`)
      .set("Authorization", "Bearer admin-token")
      .send({
        name: "Updated Company",
        website_url: "https://example.com",
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: validId,
      name: "Updated Company",
    });
  });

  it("returns 403 for non-admin users", async () => {
    const response = await request(app)
      .put(`/admin/companies/${validId}`)
      .set("Authorization", "Bearer user-token")
      .send({});

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the update payload is invalid", async () => {
    const response = await request(app)
      .put(`/admin/companies/${validId}`)
      .set("Authorization", "Bearer admin-token")
      .send({
        website_url: "not-a-url",
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.website_url");
    expect(Array.isArray(response.body.errors.website_url)).toBe(true);
  });
});
