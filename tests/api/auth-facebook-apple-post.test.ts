import request from "supertest";

let app: typeof import("../../src/index").default;
let AuthService: typeof import("../../src/services/auth.service").AuthService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  jest.doMock("../../src/services/auth.service", () => ({
    AuthService: {
      loginWithApple: jest.fn(),
      loginWithFacebook: jest.fn(),
    },
  }));

  ({ default: app } = await import("../../src/index"));
  ({ AuthService } = await import("../../src/services/auth.service"));
  ({ ResponseError: ResponseErrorClass } = await import(
    "../../src/utils/response-error.util"
  ));
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("POST /auth/facebook", () => {
  it("logs in the user with Facebook and sets the session cookie", async () => {
    const loginWithFacebookMock = jest.mocked(AuthService.loginWithFacebook);
    loginWithFacebookMock.mockResolvedValue({
      token: "facebook-token",
      expires_at: Date.now() + 120_000,
      user: {
        id: "user-facebook",
        email: "user@facebook.example",
        role: "user",
      },
    } as never);

    const response = await request(app).post("/auth/facebook").send({
      access_token: "facebook-access-token",
    });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: "user-facebook",
      email: "user@facebook.example",
      role: "user",
    });
    expect(response.headers["set-cookie"]).toBeDefined();
  });

  it("returns validation errors when Facebook auth fails", async () => {
    const loginWithFacebookMock = jest.mocked(AuthService.loginWithFacebook);
    loginWithFacebookMock.mockRejectedValue(
      new ResponseErrorClass(401, "Token Facebook tidak valid")
    );

    const response = await request(app).post("/auth/facebook").send({
      access_token: "invalid-token",
    });

    expect(response.status).toBe(401);
    expect(response.body.errors.general[0]).toBe("Token Facebook tidak valid");
  });
});

describe("POST /auth/apple", () => {
  it("logs in the user with Apple and sets the session cookie", async () => {
    const loginWithAppleMock = jest.mocked(AuthService.loginWithApple);
    loginWithAppleMock.mockResolvedValue({
      token: "apple-token",
      expires_at: Date.now() + 120_000,
      user: {
        id: "user-apple",
        email: "user@apple.example",
        role: "user",
      },
    } as never);

    const response = await request(app).post("/auth/apple").send({
      id_token: "apple-id-token",
    });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: "user-apple",
      email: "user@apple.example",
      role: "user",
    });
    expect(response.headers["set-cookie"]).toBeDefined();
  });

  it("returns validation errors when Apple auth fails", async () => {
    const loginWithAppleMock = jest.mocked(AuthService.loginWithApple);
    loginWithAppleMock.mockRejectedValue(
      new ResponseErrorClass(401, "Token Apple tidak valid")
    );

    const response = await request(app).post("/auth/apple").send({
      id_token: "invalid-token",
    });

    expect(response.status).toBe(401);
    expect(response.body.errors.general[0]).toBe("Token Apple tidak valid");
  });
});
