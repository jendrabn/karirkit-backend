import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/admin/user.service", () => ({
  UserService: {
    create: jest.fn(),
  },
}));

import app from "../../src/index";
import { UserService } from "../../src/services/admin/user.service";

describe("POST /admin/users", () => {
  const createMock = jest.mocked(UserService.create);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a user record", async () => {
    createMock.mockResolvedValue({ id: "550e8400-e29b-41d4-a716-446655440000", name: "User Baru" } as never);

    const response = await request(app)
      .post("/admin/users").set("Authorization", "Bearer admin-token")
      .send({ name: "User Baru" });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({ id: "550e8400-e29b-41d4-a716-446655440000", name: "User Baru" });
    expect(typeof response.body.data.id).toBe("string");
  });

  it("returns 403 when a non-admin user calls the endpoint", async () => {
    const response = await request(app)
      .post("/admin/users").set("Authorization", "Bearer user-token")
      .send({ name: "User Baru" });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns validation errors for invalid payloads", async () => {
    createMock.mockRejectedValue(new ResponseError(400, "Payload tidak valid"));

    const response = await request(app)
      .post("/admin/users").set("Authorization", "Bearer admin-token")
      .send({ name: "" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Payload tidak valid");
  });
});
