import request from "supertest";
import {
  buildUniqueAuthPayload,
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
        register: jest.fn(),
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

describe("POST /auth/register", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a new user account", async () => {
    const registerMock = jest.mocked(AuthService.register);
    registerMock.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      username: "user",
    } as never);

    const response = await request(app).post("/auth/register").send({
      name: "User Test",
      email: "user@example.com",
      username: "user",
      password: "secret123",
    });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: "user-1",
      email: "user@example.com",
      username: "user",
    });
    expect(typeof response.body.data.id).toBe("string");
  });

  it("returns validation-style errors when registration fails", async () => {
    const registerMock = jest.mocked(AuthService.register);
    registerMock.mockRejectedValue(
      new ResponseErrorClass(400, "Registrasi gagal", {
        email: ["Email sudah digunakan"],
      }),
    );

    const response = await request(app).post("/auth/register").send({
      name: "User Test",
      email: "user@example.com",
      username: "user",
      password: "secret123",
    });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.email");
    expect(Array.isArray(response.body.errors.email)).toBe(true);
    expect(response.body.errors.email[0]).toBe("Email sudah digunakan");
  });

  it("propagates service errors for malformed payload edge cases", async () => {
    const registerMock = jest.mocked(AuthService.register);
    registerMock.mockRejectedValue(
      new ResponseErrorClass(400, "Registrasi gagal", {
        username: ["Username minimal 3 karakter"],
      }),
    );

    const response = await request(app).post("/auth/register").send({
      name: "Us",
      email: "invalid@example.com",
      username: "ab",
      password: "secret123",
    });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.username");
    expect(response.body.errors.username[0]).toBe(
      "Username minimal 3 karakter",
    );
  });
});

describe("POST /auth/register", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();
  const trackedSettingKeys = ["auth.registration.enabled"];

  afterEach(async () => {
    const prisma = await loadPrisma();
    await prisma.systemSetting.deleteMany({
      where: { key: { in: trackedSettingKeys } },
    });
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("creates a new user account in the database", async () => {
    const payload = buildUniqueAuthPayload("register-success");
    trackedEmails.add(payload.email);

    const response = await request(app).post("/auth/register").send(payload);

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      name: payload.name,
      username: payload.username,
      email: payload.email,
      role: "user",
      status: "active",
    });
    expect(typeof response.body.data.id).toBe("string");
    expect(response.body.data).toHaveProperty("document_storage_stats");
    expect(typeof response.body.data.document_storage_stats.limit).toBe("number");
    expect(typeof response.body.data.document_storage_stats.used).toBe("number");
    expect(response.body.data).not.toHaveProperty("password");
  });

  it("returns an error when the email is already registered", async () => {
    const prisma = await loadPrisma();
    const existing = buildUniqueAuthPayload("register-duplicate");
    trackedEmails.add(existing.email);

    await prisma.user.create({
      data: {
        name: existing.name,
        username: existing.username,
        email: existing.email,
        password: "hashed-password",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const response = await request(app).post("/auth/register").send({
      ...buildUniqueAuthPayload("register-second"),
      email: existing.email,
    });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Email sudah terdaftar");
  });

  it("returns validation errors for malformed payloads", async () => {
    const response = await request(app).post("/auth/register").send({
      name: "Us",
      username: "ab",
      email: "invalid-email",
      password: "123",
    });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.name");
    expect(response.body).toHaveProperty("errors.username");
    expect(response.body).toHaveProperty("errors.email");
    expect(response.body.errors.username[0]).toBe("Username minimal 3 karakter");
  });

  it("returns 503 when registration is disabled", async () => {
    const prisma = await loadPrisma();
    await prisma.systemSetting.create({
      data: {
        key: "auth.registration.enabled",
        group: "auth",
        type: "boolean",
        valueJson: false,
        defaultValueJson: true,
        description: "Registrasi akun baru",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const payload = buildUniqueAuthPayload("register-disabled");
    trackedEmails.add(payload.email);
    const response = await request(app).post("/auth/register").send(payload);

    expect(response.status).toBe(503);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe(
      "Registrasi akun sedang dinonaktifkan"
    );
  });
});
