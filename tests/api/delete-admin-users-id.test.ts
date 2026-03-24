import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/admin/user.service", () => ({
  UserService: {
    delete: jest.fn(),
  },
}));

import app from "../../src/index";
import { UserService } from "../../src/services/admin/user.service";

const validId = "550e8400-e29b-41d4-a716-446655440000";

describe("DELETE /admin/users/:id", () => {
  const deleteMock = jest.mocked(UserService.delete);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deletes the user resource", async () => {
    deleteMock.mockResolvedValue(undefined as never);

    const response = await request(app)
      .delete(`/admin/users/${validId}`).set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
  });

  it("returns 403 for non-admin users", async () => {
    const response = await request(app)
      .delete(`/admin/users/${validId}`).set("Authorization", "Bearer user-token");

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 404 when the user cannot be found", async () => {
    deleteMock.mockRejectedValue(new ResponseError(404, "User tidak ditemukan"));

    const response = await request(app)
      .delete(`/admin/users/${validId}`).set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("User tidak ditemukan");
  });
});
