import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/admin/template.service", () => ({
  TemplateService: {
    update: jest.fn(),
  },
}));

import app from "../../src/index";
import { TemplateService } from "../../src/services/admin/template.service";

const validId = "550e8400-e29b-41d4-a716-446655440000";

describe("PUT /admin/templates/:id", () => {
  const updateMock = jest.mocked(TemplateService.update);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("updates a template record", async () => {
    updateMock.mockResolvedValue({ id: validId, name: "Template Diperbarui" } as never);

    const response = await request(app)
      .put(`/admin/templates/${validId}`).set("Authorization", "Bearer admin-token")
      .send({ name: "Template Diperbarui" });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({ id: validId, name: "Template Diperbarui" });
    expect(typeof response.body.data.name).toBe("string");
  });

  it("returns 403 when a non-admin user updates the resource", async () => {
    const response = await request(app)
      .put(`/admin/templates/${validId}`).set("Authorization", "Bearer user-token")
      .send({ name: "Template Diperbarui" });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns validation errors for invalid updates", async () => {
    updateMock.mockRejectedValue(new ResponseError(400, "Payload tidak valid"));

    const response = await request(app)
      .put(`/admin/templates/${validId}`).set("Authorization", "Bearer admin-token")
      .send({ name: "" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Payload tidak valid");
  });
});
