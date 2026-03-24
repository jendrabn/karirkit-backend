import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/document.service", () => ({
  DocumentService: {
    delete: jest.fn(),
  },
}));

import app from "../../src/index";
import { DocumentService } from "../../src/services/document.service";

const validId = "550e8400-e29b-41d4-a716-446655440000";

describe("DELETE /documents/:id", () => {
  const deleteMock = jest.mocked(DocumentService.delete);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deletes the document resource", async () => {
    deleteMock.mockResolvedValue(undefined as never);

    const response = await request(app)
      .delete(`/documents/${validId}`).set("Authorization", "Bearer user-token");

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app)
      .delete(`/documents/${validId}`);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 404 when the document cannot be found", async () => {
    deleteMock.mockRejectedValue(new ResponseError(404, "Document tidak ditemukan"));

    const response = await request(app)
      .delete(`/documents/${validId}`).set("Authorization", "Bearer user-token");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Document tidak ditemukan");
  });
});
