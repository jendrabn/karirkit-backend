import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/application-letter.service", () => ({
  ApplicationLetterService: {
    download: jest.fn(),
  },
}));

jest.mock("../../src/services/download-log.service", () => ({
  DownloadLogService: {
    checkDownloadLimit: jest.fn(),
    logDownload: jest.fn(),
  },
}));

import app from "../../src/index";
import { ApplicationLetterService } from "../../src/services/application-letter.service";
import { DownloadLogService } from "../../src/services/download-log.service";

describe("GET /application-letters/:id/download", () => {
  const downloadMock = jest.mocked(ApplicationLetterService.download);
  const checkLimitMock = jest.mocked(DownloadLogService.checkDownloadLimit);
  const logDownloadMock = jest.mocked(DownloadLogService.logDownload);
  const validId = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("downloads an application letter document", async () => {
    checkLimitMock.mockResolvedValue(undefined as never);
    logDownloadMock.mockResolvedValue(undefined as never);
    downloadMock.mockResolvedValue({
      fileName: "application-letter.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: Buffer.from("docx-content"),
    } as never);

    const response = await request(app)
      .get(`/application-letters/${validId}/download?format=docx`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(response.headers["content-disposition"]).toContain("attachment;");
    expect(logDownloadMock).toHaveBeenCalledTimes(1);
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).get(`/application-letters/${validId}/download`);

    expect(response.status).toBe(401);
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns errors when the download format is not supported", async () => {
    checkLimitMock.mockResolvedValue(undefined as never);
    downloadMock.mockRejectedValue(new ResponseError(400, "Format unduhan tidak didukung"));

    const response = await request(app)
      .get(`/application-letters/${validId}/download?format=zip`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(400);
    expect(response.body.errors.general[0]).toBe("Format unduhan tidak didukung");
  });
});
