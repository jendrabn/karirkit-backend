import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/admin/user.service", () => ({
  UserService: {
    update: jest.fn(),
  },
}));

import app from "../../src/index";
import { UserService } from "../../src/services/admin/user.service";

const validId = "550e8400-e29b-41d4-a716-446655440000";

describe("PUT /admin/users/:id", () => {
  const updateMock = jest.mocked(UserService.update);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("updates a user record", async () => {
    updateMock.mockResolvedValue({ id: validId, name: "User Diperbarui" } as never);

    const response = await request(app)
      .put(`/admin/users/${validId}`).set("Authorization", "Bearer admin-token")
      .send({ name: "User Diperbarui" });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({ id: validId, name: "User Diperbarui" });
    expect(typeof response.body.data.name).toBe("string");
  });

  it("returns 403 when a non-admin user updates the resource", async () => {
    const response = await request(app)
      .put(`/admin/users/${validId}`).set("Authorization", "Bearer user-token")
      .send({ name: "User Diperbarui" });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns validation errors for invalid updates", async () => {
    updateMock.mockRejectedValue(new ResponseError(400, "Payload tidak valid"));

    const response = await request(app)
      .put(`/admin/users/${validId}`).set("Authorization", "Bearer admin-token")
      .send({ name: "" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Payload tidak valid");
  });
});
