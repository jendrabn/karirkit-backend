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
        checkOtpStatus: jest.fn(),
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

describe("POST /auth/check-otp-status", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the current OTP status for the login flow", async () => {
    const checkOtpStatusMock = jest.mocked(OtpService.checkOtpStatus);
    checkOtpStatusMock.mockResolvedValue({
      has_active_otp: true,
      expires_in: 120,
      resend_available_at: Date.now() + 30_000,
    } as never);

    const response = await request(app).post("/auth/check-otp-status").send({
      email: "user@example.com",
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      has_active_otp: true,
      expires_in: 120,
    });
    expect(typeof response.body.data.resend_available_at).toBe("number");
  });

  it("returns validation errors when the OTP status request is invalid", async () => {
    const checkOtpStatusMock = jest.mocked(OtpService.checkOtpStatus);
    checkOtpStatusMock.mockRejectedValue(
      new ResponseErrorClass(400, "Permintaan status OTP tidak valid")
    );

    const response = await request(app).post("/auth/check-otp-status").send({
      email: "",
    });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe(
      "Permintaan status OTP tidak valid"
    );
  });

  it("supports flows that no longer require OTP", async () => {
    const checkOtpStatusMock = jest.mocked(OtpService.checkOtpStatus);
    checkOtpStatusMock.mockResolvedValue({
      has_active_otp: false,
    } as never);

    const response = await request(app).post("/auth/check-otp-status").send({
      email: "user@example.com",
    });

    expect(response.status).toBe(200);
    expect(response.body.data.has_active_otp).toBe(false);
  });
});

describe("POST /auth/check-otp-status", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();

  afterEach(async () => {
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("returns the current OTP status for the login flow", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("check-otp-status");
    trackedEmails.add(user.email);
    const createdAt = new Date(Date.now() - 15_000);
    const expiresAt = new Date(Date.now() + 4 * 60 * 1000);

    await prisma.otp.create({
      data: {
        userId: user.id,
        code: "123456",
        purpose: "login_verification",
        createdAt,
        updatedAt: createdAt,
        expiresAt,
      },
    });

    const response = await request(app).post("/auth/check-otp-status").send({
      identifier: user.email,
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      has_active_otp: true,
    });
    expect(typeof response.body.data.expires_at).toBe("number");
    expect(typeof response.body.data.expires_in).toBe("number");
    expect(typeof response.body.data.resend_available_at).toBe("number");
  });

  it("returns validation errors when the OTP status request is invalid", async () => {
    const response = await request(app).post("/auth/check-otp-status").send({
      identifier: "",
    });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.identifier");
    expect(Array.isArray(response.body.errors.identifier)).toBe(true);
  });

  it("supports flows that no longer require OTP", async () => {
    const { user } = await createRealUser("check-otp-status-empty");
    trackedEmails.add(user.email);

    const response = await request(app).post("/auth/check-otp-status").send({
      identifier: user.username,
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      has_active_otp: false,
    });
    expect(response.body.data.expires_at).toBeUndefined();
  });
});
