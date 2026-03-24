import request from "supertest";

jest.mock("../../src/services/upload.service", () => ({
  UploadService: {
    uploadFile: jest.fn(),
  },
}));

import app from "../../src/index";
import { UploadService } from "../../src/services/upload.service";

describe("POST /admin/blogs/uploads", () => {
  const uploadFileMock = jest.mocked(UploadService.uploadFile);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uploads a blog image for admin users", async () => {
    uploadFileMock.mockResolvedValue({
      path: "uploads/blogs/hero.png",
      filename: "hero.png",
    } as never);

    const response = await request(app)
      .post("/admin/blogs/uploads")
      .set("Authorization", "Bearer admin-token")
      .attach("file", Buffer.from("fake-image"), {
        filename: "hero.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      path: "uploads/blogs/hero.png",
      filename: "hero.png",
    });
  });

  it("returns 403 for non-admin users", async () => {
    const response = await request(app)
      .post("/admin/blogs/uploads")
      .set("Authorization", "Bearer user-token")
      .attach("file", Buffer.from("fake-image"), {
        filename: "hero.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the upload file is missing", async () => {
    const response = await request(app)
      .post("/admin/blogs/uploads")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(400);
    expect(response.body.errors.general[0]).toBe("File diperlukan");
  });
});
