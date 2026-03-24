import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/admin/user.service", () => ({
  UserService: {
    updateStorageLimit: jest.fn(),
  },
}));

import app from "../../src/index";
import { UserService } from "../../src/services/admin/user.service";

const validId = "550e8400-e29b-41d4-a716-446655440000";

describe("PATCH /admin/users/:id/storage-download-limit", () => {
  const updateStorageLimitMock = jest.mocked(UserService.updateStorageLimit);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("updates storage limit", async () => {
    updateStorageLimitMock.mockResolvedValue({
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "document_storage_limit": 1024
} as never);

    const response = await request(app)
      .patch(`/admin/users/${validId}/storage-download-limit`).set("Authorization", "Bearer admin-token")
      .send({
  "document_storage_limit": 1024
});

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "document_storage_limit": 1024
});
  });

  it("returns 403 for non-admin users", async () => {
    const response = await request(app)
      .patch(`/admin/users/${validId}/storage-download-limit`).set("Authorization", "Bearer user-token")
      .send({
  "document_storage_limit": 1024
});

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns validation errors for invalid patch payloads", async () => {
    updateStorageLimitMock.mockRejectedValue(new ResponseError(400, "Payload tidak valid"));

    const response = await request(app)
      .patch(`/admin/users/${validId}/storage-download-limit`).set("Authorization", "Bearer admin-token")
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Payload tidak valid");
  });
});
