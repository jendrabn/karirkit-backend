import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/admin/template.service", () => ({
  TemplateService: {
    get: jest.fn(),
  },
}));

import app from "../../src/index";
import { TemplateService } from "../../src/services/admin/template.service";

const validId = "550e8400-e29b-41d4-a716-446655440000";

describe("GET /admin/templates/:id", () => {
  const getMock = jest.mocked(TemplateService.get);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns template details", async () => {
    getMock.mockResolvedValue({ id: validId, name: "Template Detail" } as never);

    const response = await request(app)
      .get(`/admin/templates/${validId}`).set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({ id: validId, name: "Template Detail" });
    expect(typeof response.body.data.id).toBe("string");
  });

  it("returns 403 when the requester is not an admin", async () => {
    
    const response = await request(app)
      .get(`/admin/templates/${validId}`).set("Authorization", "Bearer user-token");

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required ".trim());
  });

  it("returns 404 when the template does not exist", async () => {
    getMock.mockRejectedValue(new ResponseError(404, "Template tidak ditemukan"));

    const response = await request(app)
      .get(`/admin/templates/${validId}`).set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Template tidak ditemukan");
  });
});
