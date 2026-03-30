import request from "supertest";
import {
  createRealUser,
  deleteUsersByEmail,
  disconnectPrisma,
  loadPrisma,
} from "./real-mode";

let app: typeof import("../../src/index").default;
let OtpService: typeof import("../../src/services/otp.service").OtpService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/otp.service", () => ({
      OtpService: {
        verifyOtp: jest.fn(),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ OtpService } = await import("../../src/services/otp.service"));
  ({ ResponseError: ResponseErrorClass } = await import(
    "../../src/utils/response-error.util"
  ));
});

afterAll(async () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    await disconnectPrisma();
  }
});

describe("POST /auth/verify-otp", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("verifies the OTP and creates a session cookie", async () => {
    const verifyOtpMock = jest.mocked(OtpService.verifyOtp);
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
    const verifyOtpMock = jest.mocked(OtpService.verifyOtp);
    verifyOtpMock.mockRejectedValue(
      new ResponseErrorClass(400, "Kode OTP tidak valid")
    );

    const response = await request(app).post("/auth/verify-otp").send({
      email: "user@example.com",
      otp: "000000",
    });

    expect(response.status).toBe(400);
    expect(response.body.errors.general[0]).toBe("Kode OTP tidak valid");
  });

  it("returns errors when the OTP has expired", async () => {
    const verifyOtpMock = jest.mocked(OtpService.verifyOtp);
    verifyOtpMock.mockRejectedValue(
      new ResponseErrorClass(400, "Kode OTP sudah kedaluwarsa")
    );

    const response = await request(app).post("/auth/verify-otp").send({
      email: "user@example.com",
      otp: "123456",
    });

    expect(response.status).toBe(400);
    expect(response.body.errors.general[0]).toBe("Kode OTP sudah kedaluwarsa");
  });
});

describe("POST /auth/verify-otp", () => {
  if (
    process.env.RUN_REAL_API_TESTS !== "true" ||
    process.env.OTP_ENABLED !== "true"
  ) {
    return;
  }
  const trackedEmails = new Set<string>();

  afterEach(async () => {
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("verifies the OTP and creates a session cookie", async () => {
    const prisma = await loadPrisma();
    const { user, plainPassword } = await createRealUser("verify-otp");
    trackedEmails.add(user.email);
    await prisma.otp.create({
      data: {
        userId: user.id,
        code: "123456",
        purpose: "login_verification",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const response = await request(app).post("/auth/verify-otp").send({
      identifier: user.email,
      otp_code: "123456",
      password: plainPassword,
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: user.id,
      email: user.email,
    });
    expect(response.headers["set-cookie"]).toBeDefined();

    const stored = await prisma.user.findUnique({ where: { id: user.id } });
    expect(stored?.lastLoginAt).not.toBeNull();
  });

  it("returns validation errors when the OTP is invalid", async () => {
    const { user, plainPassword } = await createRealUser("verify-otp-invalid");
    trackedEmails.add(user.email);

    const response = await request(app).post("/auth/verify-otp").send({
      identifier: user.email,
      otp_code: "000000",
      password: plainPassword,
    });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe(
      "Kredensial login atau OTP tidak valid"
    );
  });

  it("returns errors when the OTP has expired", async () => {
    const prisma = await loadPrisma();
    const { user, plainPassword } = await createRealUser("verify-otp-expired");
    trackedEmails.add(user.email);
    await prisma.otp.create({
      data: {
        userId: user.id,
        code: "123456",
        purpose: "login_verification",
        expiresAt: new Date(Date.now() - 60 * 1000),
        createdAt: new Date(Date.now() - 2 * 60 * 1000),
        updatedAt: new Date(Date.now() - 2 * 60 * 1000),
      },
    });

    const response = await request(app).post("/auth/verify-otp").send({
      identifier: user.email,
      otp_code: "123456",
      password: plainPassword,
    });

    expect(response.status).toBe(401);
    expect(response.body.errors.general[0]).toBe(
      "Kredensial login atau OTP tidak valid"
    );
  });
});
