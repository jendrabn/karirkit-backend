import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/auth.service", () => ({
  AuthService: {
    resetPassword: jest.fn(),
  },
}));

import app from "../../src/index";
import { AuthService } from "../../src/services/auth.service";

describe("POST /auth/reset-password", () => {
  const resetPasswordMock = jest.mocked(AuthService.resetPassword);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("resets the password and returns a success message", async () => {
    resetPasswordMock.mockResolvedValue(undefined as never);

    const response = await request(app).post("/auth/reset-password").send({
      token: "reset-token",
      password: "new-secret123",
      password_confirmation: "new-secret123",
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.message");
    expect(response.body.data.message).toBe("Password has been reset");
  });

  it("returns validation errors for an invalid reset token", async () => {
    resetPasswordMock.mockRejectedValue(new ResponseError(400, "Token reset tidak valid"));

    const response = await request(app).post("/auth/reset-password").send({
      token: "invalid-token",
      password: "new-secret123",
      password_confirmation: "new-secret123",
    });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Token reset tidak valid");
  });

  it("returns errors when the token has already been used", async () => {
    resetPasswordMock.mockRejectedValue(new ResponseError(400, "Token reset sudah tidak berlaku"));

    const response = await request(app).post("/auth/reset-password").send({
      token: "used-token",
      password: "new-secret123",
      password_confirmation: "new-secret123",
    });

    expect(response.status).toBe(400);
    expect(response.body.errors.general[0]).toBe("Token reset sudah tidak berlaku");
  });
});
