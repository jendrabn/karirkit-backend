import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/otp.service", () => ({
  OtpService: {
    checkOtpStatus: jest.fn(),
  },
}));

import app from "../../src/index";
import { OtpService } from "../../src/services/otp.service";

describe("POST /auth/check-otp-status", () => {
  const checkOtpStatusMock = jest.mocked(OtpService.checkOtpStatus);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the current OTP status for the login flow", async () => {
    checkOtpStatusMock.mockResolvedValue({
      requires_otp: true,
      expires_in: 120,
      resend_available_in: 30,
    } as never);

    const response = await request(app).post("/auth/check-otp-status").send({
      email: "user@example.com",
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      requires_otp: true,
      expires_in: 120,
      resend_available_in: 30,
    });
  });

  it("returns validation errors when the OTP status request is invalid", async () => {
    checkOtpStatusMock.mockRejectedValue(new ResponseError(400, "Permintaan status OTP tidak valid"));

    const response = await request(app).post("/auth/check-otp-status").send({
      email: "",
    });

    expect(response.status).toBe(400);
    expect(response.body.errors.general[0]).toBe("Permintaan status OTP tidak valid");
  });

  it("supports flows that no longer require OTP", async () => {
    checkOtpStatusMock.mockResolvedValue({
      requires_otp: false,
    } as never);

    const response = await request(app).post("/auth/check-otp-status").send({
      email: "user@example.com",
    });

    expect(response.status).toBe(200);
    expect(response.body.data.requires_otp).toBe(false);
  });
});
