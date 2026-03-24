import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/document.service", () => ({
  DocumentService: {
    download: jest.fn(),
  },
}));

import app from "../../src/index";
import { DocumentService } from "../../src/services/document.service";

describe("GET /documents/:id/download", () => {
  const downloadMock = jest.mocked(DocumentService.download);
  const validId = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("downloads a stored document", async () => {
    downloadMock.mockResolvedValue({
      fileName: "resume.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("pdf-content"),
    } as never);

    const response = await request(app)
      .get(`/documents/${validId}/download`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/pdf");
    expect(response.headers["content-disposition"]).toContain("attachment;");
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).get(`/documents/${validId}/download`);

    expect(response.status).toBe(401);
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 404 when the document does not exist", async () => {
    downloadMock.mockRejectedValue(new ResponseError(404, "Dokumen tidak ditemukan"));

    const response = await request(app)
      .get(`/documents/${validId}/download`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(404);
    expect(response.body.errors.general[0]).toBe("Dokumen tidak ditemukan");
  });
});
