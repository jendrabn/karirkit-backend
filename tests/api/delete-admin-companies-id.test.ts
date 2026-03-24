import request from "supertest";

jest.mock("../../src/services/admin/company.service", () => ({
  AdminCompanyService: {
    delete: jest.fn(),
  },
}));

import app from "../../src/index";
import { AdminCompanyService } from "../../src/services/admin/company.service";

describe("DELETE /admin/companies/:id", () => {
  const deleteMock = jest.mocked(AdminCompanyService.delete);
  const validId = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deletes a company for admin users", async () => {
    deleteMock.mockResolvedValue(undefined as never);

    const response = await request(app)
      .delete(`/admin/companies/${validId}`)
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
  });

  it("returns 403 for non-admin users", async () => {
    const response = await request(app)
      .delete(`/admin/companies/${validId}`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the company id is invalid", async () => {
    const response = await request(app)
      .delete("/admin/companies/invalid-id")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.id");
    expect(Array.isArray(response.body.errors.id)).toBe(true);
  });
});
