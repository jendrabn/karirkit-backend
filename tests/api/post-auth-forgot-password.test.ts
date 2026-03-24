import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/auth.service", () => ({
  AuthService: {
    sendPasswordResetLink: jest.fn(),
  },
}));

import app from "../../src/index";
import { AuthService } from "../../src/services/auth.service";

describe("POST /auth/forgot-password", () => {
  const forgotPasswordMock = jest.mocked(AuthService.sendPasswordResetLink);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a neutral password reset response", async () => {
    forgotPasswordMock.mockResolvedValue(undefined as never);

    const response = await request(app).post("/auth/forgot-password").send({
      email: "user@example.com",
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.message");
    expect(response.body.data.message).toBe(
      "If the email exists, reset instructions have been sent",
    );
  });

  it("returns validation errors when the reset request is invalid", async () => {
    forgotPasswordMock.mockRejectedValue(new ResponseError(400, "Email tidak valid"));

    const response = await request(app).post("/auth/forgot-password").send({
      email: "not-an-email",
    });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Email tidak valid");
  });

  it("keeps the same neutral message for unknown email addresses", async () => {
    forgotPasswordMock.mockResolvedValue(undefined as never);

    const response = await request(app).post("/auth/forgot-password").send({
      email: "missing@example.com",
    });

    expect(response.status).toBe(200);
    expect(response.body.data.message).toBe(
      "If the email exists, reset instructions have been sent",
    );
  });
});
