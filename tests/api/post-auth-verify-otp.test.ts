import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/otp.service", () => ({
  OtpService: {
    verifyOtp: jest.fn(),
  },
}));

import app from "../../src/index";
import { OtpService } from "../../src/services/otp.service";

describe("POST /auth/verify-otp", () => {
  const verifyOtpMock = jest.mocked(OtpService.verifyOtp);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("verifies the OTP and creates a session cookie", async () => {
    verifyOtpMock.mockResolvedValue({
      token: "otp-session-token",
      expires_at: Date.now() + 60_000,
      user: {
        id: "user-1",
        email: "user@example.com",
      },
    } as never);

    const response = await request(app).post("/auth/verify-otp").send({
      email: "user@example.com",
      otp: "123456",
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: "user-1",
      email: "user@example.com",
    });
    expect(response.headers["set-cookie"]).toBeDefined();
  });

  it("returns validation errors when the OTP is invalid", async () => {
    verifyOtpMock.mockRejectedValue(new ResponseError(400, "Kode OTP tidak valid"));

    const response = await request(app).post("/auth/verify-otp").send({
      email: "user@example.com",
      otp: "000000",
    });

    expect(response.status).toBe(400);
    expect(response.body.errors.general[0]).toBe("Kode OTP tidak valid");
  });

  it("returns errors when the OTP has expired", async () => {
    verifyOtpMock.mockRejectedValue(new ResponseError(400, "Kode OTP sudah kedaluwarsa"));

    const response = await request(app).post("/auth/verify-otp").send({
      email: "user@example.com",
      otp: "123456",
    });

    expect(response.status).toBe(400);
    expect(response.body.errors.general[0]).toBe("Kode OTP sudah kedaluwarsa");
  });
});
