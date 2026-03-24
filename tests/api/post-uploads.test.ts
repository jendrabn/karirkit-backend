import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/upload.service", () => ({
  UploadService: {
    uploadFile: jest.fn(),
  },
}));

import app from "../../src/index";
import { UploadService } from "../../src/services/upload.service";

describe("POST /uploads", () => {
  const uploadFileMock = jest.mocked(UploadService.uploadFile);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uploads a temporary file for authenticated users", async () => {
    uploadFileMock.mockResolvedValue({
      path: "uploads/temp/avatar.webp",
      filename: "avatar.webp",
      mimeType: "image/webp",
    } as never);

    const response = await request(app)
      .post("/uploads?quality=90&webp=true")
      .set("Authorization", "Bearer user-token")
      .attach("file", Buffer.from("fake-image"), {
        filename: "avatar.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      path: "uploads/temp/avatar.webp",
      filename: "avatar.webp",
    });
    expect(typeof response.body.data.path).toBe("string");
  });

  it("returns 401 when upload is requested without authentication", async () => {
    const response = await request(app)
      .post("/uploads");

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 400 when the file is missing", async () => {
    uploadFileMock.mockRejectedValue(new ResponseError(400, "File diperlukan"));

    const response = await request(app)
      .post("/uploads")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("File diperlukan");
  });
});
