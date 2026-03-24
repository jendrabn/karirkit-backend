import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/otp.service", () => ({
  OtpService: {
    resendOtp: jest.fn(),
  },
}));

import app from "../../src/index";
import { OtpService } from "../../src/services/otp.service";

describe("POST /auth/resend-otp", () => {
  const resendOtpMock = jest.mocked(OtpService.resendOtp);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("resends the OTP and returns resend metadata", async () => {
    resendOtpMock.mockResolvedValue({
      message: "OTP berhasil dikirim ulang",
      expires_in: 300,
      resend_available_at: Date.now() + 60_000,
    } as never);

    const response = await request(app).post("/auth/resend-otp").send({
      email: "user@example.com",
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      message: "OTP berhasil dikirim ulang",
      expires_in: 300,
    });
    expect(typeof response.body.data.resend_available_at).toBe("number");
  });

  it("returns validation errors when the resend request is invalid", async () => {
    resendOtpMock.mockRejectedValue(new ResponseError(400, "Permintaan OTP tidak valid"));

    const response = await request(app).post("/auth/resend-otp").send({
      email: "",
    });

    expect(response.status).toBe(400);
    expect(response.body.errors.general[0]).toBe("Permintaan OTP tidak valid");
  });

  it("returns cooldown information when resend is attempted too early", async () => {
    resendOtpMock.mockResolvedValue({
      message: "OTP belum dapat dikirim ulang",
      retry_in: 45,
    } as never);

    const response = await request(app).post("/auth/resend-otp").send({
      email: "user@example.com",
    });

    expect(response.status).toBe(200);
    expect(response.body.data.message).toBe("OTP belum dapat dikirim ulang");
    expect(response.body.data.retry_in).toBe(45);
  });
});
