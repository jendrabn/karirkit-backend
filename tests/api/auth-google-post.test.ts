import request from "supertest";
import {
  createRealUser,
  deleteUsersByEmail,
  disconnectPrisma,
  loadPrisma,
} from "./real-mode";

let mockGooglePayload:
  | {
      sub: string;
      email: string;
      email_verified?: boolean;
      name?: string;
      picture?: string;
    }
  | null = null;
let mockGoogleVerifyError: Error | null = null;

const verifyIdTokenMock = jest.fn(async () => {
  if (mockGoogleVerifyError) {
    throw mockGoogleVerifyError;
  }
  return {
    getPayload: () => mockGooglePayload,
  };
});

let app: typeof import("../../src/index").default;
let AuthService: typeof import("../../src/services/auth.service").AuthService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/auth.service", () => ({
      AuthService: {
        loginWithGoogle: jest.fn(),
      },
    }));
  } else {
    jest.doMock("google-auth-library", () => ({
      OAuth2Client: jest.fn().mockImplementation(() => ({
        verifyIdToken: verifyIdTokenMock,
      })),
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

describe("POST /auth/google", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("logs in the user with Google and sets the session cookie", async () => {
    const loginWithGoogleMock = jest.mocked(AuthService.loginWithGoogle);
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
    const loginWithGoogleMock = jest.mocked(AuthService.loginWithGoogle);
    loginWithGoogleMock.mockRejectedValue(
      new ResponseErrorClass(400, "Token Google tidak valid")
    );

    const response = await request(app).post("/auth/google").send({
      id_token: "invalid-token",
    });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Token Google tidak valid");
  });

  it("preserves important user data returned by the Google auth flow", async () => {
    const loginWithGoogleMock = jest.mocked(AuthService.loginWithGoogle);
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

describe("POST /auth/google", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGooglePayload = null;
    mockGoogleVerifyError = null;
  });

  afterEach(async () => {
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("logs in the user with Google and sets the session cookie", async () => {
    const prisma = await loadPrisma();
    const email = `google-user-${Date.now()}@example.com`;
    trackedEmails.add(email);
    mockGooglePayload = {
      sub: `google-sub-${Date.now()}`,
      email,
      email_verified: true,
      name: "Google User",
      picture: "https://example.com/avatar.jpg",
    };

    const response = await request(app).post("/auth/google").send({
      id_token: "google-id-token",
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      email,
      role: "user",
    });
    expect(response.headers["set-cookie"]).toBeDefined();

    const stored = await prisma.user.findUnique({ where: { email } });
    expect(stored?.lastLoginAt).not.toBeNull();
  });

  it("returns validation errors when the Google token is invalid", async () => {
    mockGoogleVerifyError = new Error("invalid google token");

    const response = await request(app).post("/auth/google").send({
      id_token: "invalid-token",
    });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Token Google tidak valid");
  });

  it("preserves important user data returned by the Google auth flow", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("google-existing-admin", {
      role: "admin",
      email: `google-admin-${Date.now()}@example.com`,
    });
    trackedEmails.add(user.email);
    mockGooglePayload = {
      sub: `google-admin-sub-${Date.now()}`,
      email: user.email,
      email_verified: true,
      name: user.name,
    };

    const response = await request(app).post("/auth/google").send({
      id_token: "google-id-token",
    });

    expect(response.status).toBe(200);
    expect(response.body.data.role).toBe("admin");
    expect(response.body.data.email).toBe(user.email);

    const stored = await prisma.user.findUnique({ where: { id: user.id } });
    expect(stored?.lastLoginAt).not.toBeNull();
  });

  it("uses free plan defaults for newly created Google users", async () => {
    const prisma = await loadPrisma();
    const email = `google-defaults-${Date.now()}@example.com`;
    trackedEmails.add(email);

    mockGooglePayload = {
      sub: `google-defaults-sub-${Date.now()}`,
      email,
      email_verified: true,
      name: "Google Defaults",
    };

    const response = await request(app).post("/auth/google").send({
      id_token: "google-id-token",
    });

    expect(response.status).toBe(200);

    const stored = await prisma.user.findUnique({ where: { email } });
    expect(stored).not.toBeNull();
    expect(stored?.subscriptionPlan).toBe("free");
    expect(stored?.lastLoginAt).not.toBeNull();
    expect(response.body.data).not.toHaveProperty("daily_download_limit");
    expect(response.body.data).not.toHaveProperty("document_storage_limit");
  });
});
