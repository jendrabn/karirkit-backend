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
let enqueueEmailMock: jest.MockedFunction<any>;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/otp.service", () => ({
      OtpService: {
        resendOtp: jest.fn(),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ OtpService } = await import("../../src/services/otp.service"));
  ({ ResponseError: ResponseErrorClass } = await import(
    "../../src/utils/response-error.util"
  ));
  enqueueEmailMock = jest.mocked(
    (await import("../../src/queues/email.queue")).enqueueEmail
  );
});

afterAll(async () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    await disconnectPrisma();
  }
});

describe("POST /auth/resend-otp", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("resends the OTP and returns resend metadata", async () => {
    const resendOtpMock = jest.mocked(OtpService.resendOtp);
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
    const resendOtpMock = jest.mocked(OtpService.resendOtp);
    resendOtpMock.mockRejectedValue(
      new ResponseErrorClass(400, "Permintaan OTP tidak valid")
    );

    const response = await request(app).post("/auth/resend-otp").send({
      email: "",
    });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Permintaan OTP tidak valid");
  });

  it("returns cooldown information when resend is attempted too early", async () => {
    const resendOtpMock = jest.mocked(OtpService.resendOtp);
    resendOtpMock.mockRejectedValue(
      new ResponseErrorClass(
        429,
        "OTP sudah dikirim. Silakan tunggu sebelum meminta yang baru.",
        {
          remaining_time: ["45"],
          resend_available_at: [String(Date.now() + 45_000)],
        }
      )
    );

    const response = await request(app).post("/auth/resend-otp").send({
      email: "user@example.com",
    });

    expect(response.status).toBe(429);
    expect(response.body).toHaveProperty("errors.remaining_time");
    expect(response.body.errors.remaining_time[0]).toBe("45");
  });
});

describe("POST /auth/resend-otp", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();

  afterEach(async () => {
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
    jest.clearAllMocks();
  });

  it("resends the OTP and returns resend metadata", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("resend-otp");
    trackedEmails.add(user.email);

    const response = await request(app).post("/auth/resend-otp").send({
      identifier: user.email,
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      message: "OTP telah dikirim ulang ke email Anda",
    });
    expect(typeof response.body.data.expires_at).toBe("number");
    expect(typeof response.body.data.expires_in).toBe("number");
    expect(typeof response.body.data.resend_available_at).toBe("number");
    expect(enqueueEmailMock).toHaveBeenCalledTimes(1);

    const otp = await prisma.otp.findFirst({
      where: { userId: user.id, purpose: "login_verification" },
    });
    expect(otp).not.toBeNull();
  });

  it("returns validation errors when the resend request is invalid", async () => {
    const response = await request(app).post("/auth/resend-otp").send({
      identifier: "",
    });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.identifier");
    expect(Array.isArray(response.body.errors.identifier)).toBe(true);
  });

  it("returns cooldown information when resend is attempted too early", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("resend-otp-cooldown");
    trackedEmails.add(user.email);
    const now = new Date();

    await prisma.otp.create({
      data: {
        userId: user.id,
        code: "123456",
        purpose: "login_verification",
        createdAt: now,
        updatedAt: now,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    const response = await request(app).post("/auth/resend-otp").send({
      identifier: user.username,
    });

    expect(response.status).toBe(429);
    expect(response.body).toHaveProperty("errors.remaining_time");
    expect(response.body).toHaveProperty("errors.resend_available_at");
    expect(Number(response.body.errors.remaining_time[0])).toBeGreaterThan(0);
    expect(Number(response.body.errors.resend_available_at[0])).toBeGreaterThan(
      Date.now() - 1_000
    );
    expect(enqueueEmailMock).not.toHaveBeenCalled();
  });
});
