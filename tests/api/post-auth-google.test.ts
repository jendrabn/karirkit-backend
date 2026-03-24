import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/auth.service", () => ({
  AuthService: {
    loginWithGoogle: jest.fn(),
  },
}));

import app from "../../src/index";
import { AuthService } from "../../src/services/auth.service";

describe("POST /auth/google", () => {
  const loginWithGoogleMock = jest.mocked(AuthService.loginWithGoogle);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("logs in the user with Google and sets the session cookie", async () => {
    loginWithGoogleMock.mockResolvedValue({
      token: "google-token",
      expires_at: Date.now() + 120_000,
      user: {
        id: "user-1",
        email: "user@gmail.com",
        role: "user",
      },
    } as never);

    const response = await request(app).post("/auth/google").send({
      id_token: "google-id-token",
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: "user-1",
      email: "user@gmail.com",
      role: "user",
    });
    expect(response.headers["set-cookie"]).toBeDefined();
  });

  it("returns validation errors when the Google token is invalid", async () => {
    loginWithGoogleMock.mockRejectedValue(
      new ResponseError(400, "Token Google tidak valid"),
    );

    const response = await request(app).post("/auth/google").send({
      id_token: "invalid-token",
    });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Token Google tidak valid");
  });

  it("preserves important user data returned by the Google auth flow", async () => {
    loginWithGoogleMock.mockResolvedValue({
      token: "google-token",
      expires_at: Date.now() + 120_000,
      user: {
        id: "admin-1",
        email: "admin@gmail.com",
        role: "admin",
      },
    } as never);

    const response = await request(app).post("/auth/google").send({
      id_token: "google-id-token",
    });

    expect(response.status).toBe(200);
    expect(response.body.data.role).toBe("admin");
    expect(typeof response.body.data.email).toBe("string");
  });
});
