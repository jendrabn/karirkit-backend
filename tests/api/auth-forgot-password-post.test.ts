import request from "supertest";
import {
  createRealUser,
  deleteUsersByEmail,
  disconnectPrisma,
} from "./real-mode";

let app: typeof import("../../src/index").default;
let AuthService: typeof import("../../src/services/auth.service").AuthService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;
let enqueueEmailMock: jest.MockedFunction<any>;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/auth.service", () => ({
      AuthService: {
        sendPasswordResetLink: jest.fn(),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ AuthService } = await import("../../src/services/auth.service"));
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

describe("POST /auth/forgot-password", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a neutral password reset response", async () => {
    const forgotPasswordMock = jest.mocked(AuthService.sendPasswordResetLink);
    forgotPasswordMock.mockResolvedValue(undefined as never);

    const response = await request(app).post("/auth/forgot-password").send({
      email: "user@example.com",
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.message");
    expect(response.body.data.message).toBe(
      "If the email exists, reset instructions have been sent"
    );
  });

  it("returns validation errors when the reset request is invalid", async () => {
    const forgotPasswordMock = jest.mocked(AuthService.sendPasswordResetLink);
    forgotPasswordMock.mockRejectedValue(
      new ResponseErrorClass(400, "Email tidak valid")
    );

    const response = await request(app).post("/auth/forgot-password").send({
      email: "not-an-email",
    });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Email tidak valid");
  });

  it("keeps the same neutral message for unknown email addresses", async () => {
    const forgotPasswordMock = jest.mocked(AuthService.sendPasswordResetLink);
    forgotPasswordMock.mockResolvedValue(undefined as never);

    const response = await request(app).post("/auth/forgot-password").send({
      email: "missing@example.com",
    });

    expect(response.status).toBe(200);
    expect(response.body.data.message).toBe(
      "If the email exists, reset instructions have been sent"
    );
  });
});

describe("POST /auth/forgot-password", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();

  afterEach(async () => {
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
    jest.clearAllMocks();
  });

  it("returns a neutral password reset response", async () => {
    const { user } = await createRealUser("forgot-password");
    trackedEmails.add(user.email);

    const response = await request(app).post("/auth/forgot-password").send({
      email: user.email,
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.message");
    expect(response.body.data.message).toBe(
      "If the email exists, reset instructions have been sent"
    );
    expect(enqueueEmailMock).toHaveBeenCalledTimes(1);
  });

  it("returns validation errors when the reset request is invalid", async () => {
    const response = await request(app).post("/auth/forgot-password").send({
      email: "not-an-email",
    });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.email");
    expect(Array.isArray(response.body.errors.email)).toBe(true);
  });

  it("keeps the same neutral message for unknown email addresses", async () => {
    const response = await request(app).post("/auth/forgot-password").send({
      email: "missing@example.com",
    });

    expect(response.status).toBe(200);
    expect(response.body.data.message).toBe(
      "If the email exists, reset instructions have been sent"
    );
    expect(enqueueEmailMock).not.toHaveBeenCalled();
  });
});
