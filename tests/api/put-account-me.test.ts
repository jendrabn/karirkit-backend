import request from "supertest";

jest.mock("../../src/services/account.service", () => ({
  AccountService: {
    updateMe: jest.fn(),
  },
}));

jest.mock("../../src/services/upload.service", () => ({
  UploadService: {
    uploadFile: jest.fn(),
  },
}));

import app from "../../src/index";
import { AccountService } from "../../src/services/account.service";
import { UploadService } from "../../src/services/upload.service";

describe("PUT /account/me", () => {
  const updateMeMock = jest.mocked(AccountService.updateMe);
  const uploadFileMock = jest.mocked(UploadService.uploadFile);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("updates the authenticated profile and uploads the avatar when present", async () => {
    uploadFileMock.mockResolvedValue({ path: "uploads/temp/avatar.webp" } as never);
    updateMeMock.mockResolvedValue({
      id: "user-1",
      username: "user",
      avatar: "uploads/temp/avatar.webp",
    } as never);

    const response = await request(app)
      .put("/account/me")
      .set("Authorization", "Bearer user-token")
      .field("username", "user")
      .field(
        "social_links",
        JSON.stringify([
          { platform: "linkedin", url: "https://linkedin.com/in/user" },
        ]),
      )
      .attach("file", Buffer.from("fake-avatar"), {
        filename: "avatar.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: "user-1",
      username: "user",
      avatar: "uploads/temp/avatar.webp",
    });
    expect(uploadFileMock).toHaveBeenCalledTimes(1);
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).put("/account/me").send({
      username: "user",
    });

    expect(response.status).toBe(401);
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 400 when social_links is not valid JSON", async () => {
    const response = await request(app)
      .put("/account/me")
      .set("Authorization", "Bearer user-token")
      .field("username", "user")
      .field("social_links", "{invalid-json}");

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Format social_links tidak valid");
  });
});
