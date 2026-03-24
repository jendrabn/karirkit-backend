import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/admin/user.service", () => ({
  UserService: {
    get: jest.fn(),
  },
}));

import app from "../../src/index";
import { UserService } from "../../src/services/admin/user.service";

const validId = "550e8400-e29b-41d4-a716-446655440000";

describe("GET /admin/users/:id", () => {
  const getMock = jest.mocked(UserService.get);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns user details", async () => {
    getMock.mockResolvedValue({ id: validId, name: "User Detail" } as never);

    const response = await request(app)
      .get(`/admin/users/${validId}`).set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({ id: validId, name: "User Detail" });
    expect(typeof response.body.data.id).toBe("string");
  });

  it("returns 403 when the requester is not an admin", async () => {
    
    const response = await request(app)
      .get(`/admin/users/${validId}`).set("Authorization", "Bearer user-token");

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required ".trim());
  });

  it("returns 404 when the user does not exist", async () => {
    getMock.mockRejectedValue(new ResponseError(404, "User tidak ditemukan"));

    const response = await request(app)
      .get(`/admin/users/${validId}`).set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("User tidak ditemukan");
  });
});
