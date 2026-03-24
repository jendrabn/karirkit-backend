import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/admin/user.service", () => ({
  UserService: {
    updateDailyDownloadLimit: jest.fn(),
  },
}));

import app from "../../src/index";
import { UserService } from "../../src/services/admin/user.service";

const validId = "550e8400-e29b-41d4-a716-446655440000";

describe("PATCH /admin/users/:id/daily-download-limit", () => {
  const updateDailyDownloadLimitMock = jest.mocked(UserService.updateDailyDownloadLimit);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("updates daily download limit", async () => {
    updateDailyDownloadLimitMock.mockResolvedValue({
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "daily_download_limit": 25
} as never);

    const response = await request(app)
      .patch(`/admin/users/${validId}/daily-download-limit`).set("Authorization", "Bearer admin-token")
      .send({
  "daily_download_limit": 25
});

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "daily_download_limit": 25
});
  });

  it("returns 403 for non-admin users", async () => {
    const response = await request(app)
      .patch(`/admin/users/${validId}/daily-download-limit`).set("Authorization", "Bearer user-token")
      .send({
  "daily_download_limit": 25
});

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns validation errors for invalid patch payloads", async () => {
    updateDailyDownloadLimitMock.mockRejectedValue(new ResponseError(400, "Payload tidak valid"));

    const response = await request(app)
      .patch(`/admin/users/${validId}/daily-download-limit`).set("Authorization", "Bearer admin-token")
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Payload tidak valid");
  });
});
