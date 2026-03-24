import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/auth.service", () => ({
  AuthService: {
    login: jest.fn(),
  },
}));

import app from "../../src/index";
import { AuthService } from "../../src/services/auth.service";

describe("POST /auth/login", () => {
  const loginMock = jest.mocked(AuthService.login);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("logs in the user and sets the session cookie", async () => {
    loginMock.mockResolvedValue({
      token: "session-token",
      expires_at: Date.now() + 60_000,
      user: {
        id: "user-1",
        email: "user@example.com",
        role: "user",
      },
    } as never);

    const response = await request(app).post("/auth/login").send({
      email: "user@example.com",
      password: "secret123",
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: "user-1",
      email: "user@example.com",
      role: "user",
    });
    expect(response.headers["set-cookie"]).toBeDefined();
  });

  it("returns validation errors when login fails", async () => {
    loginMock.mockRejectedValue(new ResponseError(400, "Email atau password salah"));

    const response = await request(app).post("/auth/login").send({
      email: "user@example.com",
      password: "wrong-password",
    });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Email atau password salah");
  });

  it("returns OTP instructions when the account requires two-step verification", async () => {
    loginMock.mockResolvedValue({
      requires_otp: true,
      message: "Kode OTP telah dikirim",
      expires_at: Date.now() + 300_000,
      expires_in: 300,
      resend_available_at: Date.now() + 60_000,
    } as never);

    const response = await request(app).post("/auth/login").send({
      email: "user@example.com",
      password: "secret123",
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      message: "Kode OTP telah dikirim",
      requires_otp: true,
      expires_in: 300,
    });
    expect(typeof response.body.data.expires_at).toBe("number");
  });
});
