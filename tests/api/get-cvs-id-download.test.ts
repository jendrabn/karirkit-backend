import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/cv.service", () => ({
  CvService: {
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
import { CvService } from "../../src/services/cv.service";
import { DownloadLogService } from "../../src/services/download-log.service";

describe("GET /cvs/:id/download", () => {
  const downloadMock = jest.mocked(CvService.download);
  const checkLimitMock = jest.mocked(DownloadLogService.checkDownloadLimit);
  const logDownloadMock = jest.mocked(DownloadLogService.logDownload);
  const validId = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("downloads a CV document", async () => {
    checkLimitMock.mockResolvedValue(undefined as never);
    logDownloadMock.mockResolvedValue(undefined as never);
    downloadMock.mockResolvedValue({
      fileName: "resume.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("pdf-content"),
    } as never);

    const response = await request(app)
      .get(`/cvs/${validId}/download?format=pdf`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/pdf");
    expect(response.headers["content-disposition"]).toContain("attachment;");
    expect(logDownloadMock).toHaveBeenCalledTimes(1);
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).get(`/cvs/${validId}/download`);

    expect(response.status).toBe(401);
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns errors when the requested format is invalid", async () => {
    checkLimitMock.mockResolvedValue(undefined as never);
    downloadMock.mockRejectedValue(new ResponseError(400, "Format CV tidak didukung"));

    const response = await request(app)
      .get(`/cvs/${validId}/download?format=zip`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(400);
    expect(response.body.errors.general[0]).toBe("Format CV tidak didukung");
  });
});
