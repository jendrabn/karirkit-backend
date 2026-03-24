import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/auth.service", () => ({
  AuthService: {
    register: jest.fn(),
  },
}));

import app from "../../src/index";
import { AuthService } from "../../src/services/auth.service";

describe("POST /auth/register", () => {
  const registerMock = jest.mocked(AuthService.register);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a new user account", async () => {
    registerMock.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      username: "user",
    } as never);

    const response = await request(app).post("/auth/register").send({
      name: "User Test",
      email: "user@example.com",
      username: "user",
      password: "secret123",
    });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: "user-1",
      email: "user@example.com",
      username: "user",
    });
    expect(typeof response.body.data.id).toBe("string");
  });

  it("returns validation-style errors when registration fails", async () => {
    registerMock.mockRejectedValue(
      new ResponseError(400, "Registrasi gagal", {
        email: ["Email sudah digunakan"],
      }),
    );

    const response = await request(app).post("/auth/register").send({
      name: "User Test",
      email: "user@example.com",
      username: "user",
      password: "secret123",
    });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.email");
    expect(Array.isArray(response.body.errors.email)).toBe(true);
    expect(response.body.errors.email[0]).toBe("Email sudah digunakan");
  });

  it("propagates service errors for malformed payload edge cases", async () => {
    registerMock.mockRejectedValue(
      new ResponseError(400, "Registrasi gagal", {
        username: ["Username minimal 3 karakter"],
      }),
    );

    const response = await request(app).post("/auth/register").send({
      name: "Us",
      email: "invalid@example.com",
      username: "ab",
      password: "secret123",
    });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.username");
    expect(response.body.errors.username[0]).toBe(
      "Username minimal 3 karakter",
    );
  });
});
