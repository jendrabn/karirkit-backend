import request from "supertest";
import {
  createRealUser,
  deleteUsersByEmail,
  disconnectPrisma,
  loadPrisma,
} from "./real-mode";

let app: typeof import("../../src/index").default;
let AuthService: typeof import("../../src/services/auth.service").AuthService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/auth.service", () => ({
      AuthService: {
        resetPassword: jest.fn(),
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

describe("POST /auth/reset-password", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("resets the password and returns a success message", async () => {
    const resetPasswordMock = jest.mocked(AuthService.resetPassword);
    resetPasswordMock.mockResolvedValue(undefined as never);

    const response = await request(app).post("/auth/reset-password").send({
      token: "reset-token-value",
      password: "new-secret123",
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.message");
    expect(response.body.data.message).toBe("Password has been reset");
  });

  it("returns validation errors for an invalid reset token", async () => {
    const resetPasswordMock = jest.mocked(AuthService.resetPassword);
    resetPasswordMock.mockRejectedValue(
      new ResponseErrorClass(400, "Token reset tidak valid")
    );

    const response = await request(app).post("/auth/reset-password").send({
      token: "invalid-token",
      password: "new-secret123",
    });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Token reset tidak valid");
  });

  it("returns errors when the token has already been used", async () => {
    const resetPasswordMock = jest.mocked(AuthService.resetPassword);
    resetPasswordMock.mockRejectedValue(
      new ResponseErrorClass(400, "Token reset sudah tidak berlaku")
    );

    const response = await request(app).post("/auth/reset-password").send({
      token: "used-token-value",
      password: "new-secret123",
    });

    expect(response.status).toBe(400);
    expect(response.body.errors.general[0]).toBe(
      "Token reset sudah tidak berlaku"
    );
  });
});

describe("POST /auth/reset-password", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();

  afterEach(async () => {
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("resets the password and returns a success message", async () => {
    const prisma = await loadPrisma();
    const [{ default: jwt }, { default: env }, { default: bcrypt }] =
      await Promise.all([
        import("jsonwebtoken"),
        import("../../src/config/env.config"),
        import("bcrypt"),
      ]);
    const { user } = await createRealUser("reset-password");
    trackedEmails.add(user.email);
    const token = jwt.sign(
      { sub: user.id, type: "password_reset" },
      env.jwtSecret,
      { expiresIn: "15m" }
    );

    const response = await request(app).post("/auth/reset-password").send({
      token,
      password: "new-secret123",
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.message");
    expect(response.body.data.message).toBe("Password has been reset");

    const stored = await prisma.user.findUnique({ where: { id: user.id } });
    expect(await bcrypt.compare("new-secret123", stored!.password)).toBe(true);
  });

  it("returns validation errors for an invalid reset token", async () => {
    const response = await request(app).post("/auth/reset-password").send({
      token: "invalid-token",
      password: "new-secret123",
    });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
  });

  it("returns errors when the token references a missing user", async () => {
    const [{ default: jwt }, { default: env }] = await Promise.all([
      import("jsonwebtoken"),
      import("../../src/config/env.config"),
    ]);
    const token = jwt.sign(
      {
        sub: "550e8400-e29b-41d4-a716-446655440099",
        type: "password_reset",
      },
      env.jwtSecret,
      { expiresIn: "15m" }
    );

    const response = await request(app).post("/auth/reset-password").send({
      token,
      password: "new-secret123",
    });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe(
      "Token reset kata sandi tidak valid"
    );
  });
});
