import request from "supertest";
import {
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
  loadPrisma,
} from "./real-mode";

let app: typeof import("../../src/index").default;
let AccountService: typeof import("../../src/services/account.service").AccountService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/account.service", () => ({
      AccountService: {
        me: jest.fn(),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ AccountService } = await import("../../src/services/account.service"));
  ({ ResponseError: ResponseErrorClass } = await import(
    "../../src/utils/response-error.util"
  ));
});

afterAll(async () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    await disconnectPrisma();
  }
});

describe("GET /account/me", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the authenticated account profile", async () => {
    const meMock = jest.mocked(AccountService.me);
    meMock.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      username: "user",
    } as never);

    const response = await request(app)
      .get("/account/me")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: "user-1",
      email: "user@example.com",
      username: "user",
    });
    expect(typeof response.body.data.id).toBe("string");
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).get("/account/me");

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("propagates service errors when the account cannot be loaded", async () => {
    const meMock = jest.mocked(AccountService.me);
    meMock.mockRejectedValue(new ResponseErrorClass(404, "Akun tidak ditemukan"));

    const response = await request(app)
      .get("/account/me")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(404);
    expect(response.body.errors.general[0]).toBe("Akun tidak ditemukan");
  });
});

describe("GET /account/me", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();

  afterEach(async () => {
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("returns the authenticated account profile from the database", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("account-me-success");
    trackedEmails.add(user.email);

    await prisma.userSocialLink.create({
      data: {
        userId: user.id,
        platform: "linkedin",
        url: "https://linkedin.com/in/test-user",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    await prisma.document.create({
      data: {
        userId: user.id,
        type: "cv",
        originalName: "resume.pdf",
        path: "/uploads/documents/resume.pdf",
        mimeType: "application/pdf",
        size: 2048,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    await prisma.downloadLog.create({
      data: {
        userId: user.id,
        type: "cv",
        documentId: "resume-1",
        documentName: "resume.pdf",
      },
    });

    const token = await createSessionToken(user);
    const response = await request(app)
      .get("/account/me")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: user.id,
      email: user.email,
      username: user.username,
      role: "user",
      status: "active",
    });
    expect(Array.isArray(response.body.data.social_links)).toBe(true);
    expect(response.body.data.social_links[0]).toMatchObject({
      platform: "linkedin",
      url: "https://linkedin.com/in/test-user",
    });
    expect(response.body.data).toHaveProperty("download_stats");
    expect(response.body.data.download_stats.today_count).toBe(1);
    expect(response.body.data).toHaveProperty("document_storage_stats");
    expect(response.body.data.document_storage_stats.used).toBe(2048);
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).get("/account/me");

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("blocks suspended accounts even when the token is valid", async () => {
    const { user } = await createRealUser("account-me-suspended", {
      status: "suspended",
      statusReason: "Sedang ditinjau",
      suspendedUntil: new Date("2030-01-01T00:00:00.000Z"),
    });
    trackedEmails.add(user.email);

    const token = await createSessionToken(user);
    const response = await request(app)
      .get("/account/me")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toContain("Akun ditangguhkan sementara");
    expect(response.body.errors.general[0]).toContain("Sedang ditinjau");
  });
});
