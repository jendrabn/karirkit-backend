import request from "supertest";

jest.mock("../../src/services/admin/company.service", () => ({
  AdminCompanyService: {
    list: jest.fn(),
  },
}));

import app from "../../src/index";
import { AdminCompanyService } from "../../src/services/admin/company.service";

describe("GET /admin/companies", () => {
  const listMock = jest.mocked(AdminCompanyService.list);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns admin company listings", async () => {
    listMock.mockResolvedValue({
      items: [{ id: "company-1", name: "Acme" }],
      meta: { page: 1, per_page: 20, total: 1 },
    } as never);

    const response = await request(app)
      .get("/admin/companies")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body.data.items[0]).toMatchObject({
      id: "company-1",
      name: "Acme",
    });
  });

  it("returns 403 for non-admin users", async () => {
    const response = await request(app)
      .get("/admin/companies")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the company range query is invalid", async () => {
    const response = await request(app)
      .get("/admin/companies?job_count_from=10&job_count_to=5")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.job_count_from");
    expect(Array.isArray(response.body.errors.job_count_from)).toBe(true);
  });
});
