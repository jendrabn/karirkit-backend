import request from "supertest";

jest.mock("../../src/services/admin/company.service", () => ({
  AdminCompanyService: {
    create: jest.fn(),
  },
}));

import app from "../../src/index";
import { AdminCompanyService } from "../../src/services/admin/company.service";

describe("POST /admin/companies", () => {
  const createMock = jest.mocked(AdminCompanyService.create);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a company for admin users", async () => {
    createMock.mockResolvedValue({
      id: "company-1",
      name: "PT Example",
    } as never);

    const response = await request(app)
      .post("/admin/companies")
      .set("Authorization", "Bearer admin-token")
      .send({
        name: "PT Example",
        description: "Technology company",
        website_url: "https://example.com",
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: "company-1",
      name: "PT Example",
    });
  });

  it("returns 403 for non-admin users", async () => {
    const response = await request(app)
      .post("/admin/companies")
      .set("Authorization", "Bearer user-token")
      .send({});

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the company payload is invalid", async () => {
    const response = await request(app)
      .post("/admin/companies")
      .set("Authorization", "Bearer admin-token")
      .send({
        name: "AB",
        website_url: "not-a-url",
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.name");
    expect(Array.isArray(response.body.errors.name)).toBe(true);
  });
});
