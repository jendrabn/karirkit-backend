import request from "supertest";
import {
  createRealUser,
  deleteUsersByEmail,
  disconnectPrisma,
} from "./real-mode";

let app: typeof import("../../src/index").default;
let AuthService: typeof import("../../src/services/auth.service").AuthService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/auth.service", () => ({
      AuthService: {
        login: jest.fn(),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ AuthService } = await import("../../src/services/auth.service"));
  ({ ResponseError: ResponseErrorClass } = await import(
    "../../src/utils/response-error.util"
  ));
});

afterAll(async () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    await disconnectPrisma();
  }
});

describe("POST /auth/login", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("logs in the user and sets the session cookie", async () => {
    const loginMock = jest.mocked(AuthService.login);
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
      identifier: "user@example.com",
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
    const loginMock = jest.mocked(AuthService.login);
    loginMock.mockRejectedValue(
      new ResponseErrorClass(400, "Email atau password salah"),
    );

    const response = await request(app).post("/auth/login").send({
      identifier: "user@example.com",
      password: "wrong-password",
    });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Email atau password salah");
  });

  it("returns OTP instructions when the account requires two-step verification", async () => {
    const loginMock = jest.mocked(AuthService.login);
    loginMock.mockResolvedValue({
      requires_otp: true,
      message: "Kode OTP telah dikirim",
      expires_at: Date.now() + 300_000,
      expires_in: 300,
      resend_available_at: Date.now() + 60_000,
    } as never);

    const response = await request(app).post("/auth/login").send({
      identifier: "user@example.com",
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

describe("POST /auth/login", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();

  afterEach(async () => {
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("logs in a real user and sets the session cookie", async () => {
    const { user, plainPassword } = await createRealUser("login-success");
    trackedEmails.add(user.email);

    const response = await request(app).post("/auth/login").send({
      identifier: user.email,
      password: plainPassword,
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: user.id,
      email: user.email,
      username: user.username,
      role: "user",
    });
    expect(response.body.data).toHaveProperty("document_storage_stats");
    expect(response.headers["set-cookie"]).toBeDefined();
    expect(response.headers["set-cookie"][0]).toContain("karirkit_session=");
  });

  it("returns 401 when the password is wrong", async () => {
    const { user } = await createRealUser("login-wrong-password");
    trackedEmails.add(user.email);

    const response = await request(app).post("/auth/login").send({
      identifier: user.email,
      password: "wrong-password",
    });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe(
      "Email, username, atau kata sandi salah",
    );
  });

  it("allows login using the username as identifier", async () => {
    const { user, plainPassword } = await createRealUser("login-username");
    trackedEmails.add(user.email);

    const response = await request(app).post("/auth/login").send({
      identifier: user.username,
      password: plainPassword,
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.id", user.id);
    expect(response.body.data.username).toBe(user.username);
    expect(typeof response.body.data.email).toBe("string");
  });
});
