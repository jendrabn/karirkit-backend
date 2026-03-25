import request from "supertest";
import {
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
  loadPrisma,
} from "./real-mode";

const validId = "550e8400-e29b-41d4-a716-446655440000";
let app: typeof import("../../src/index").default;
let UserService: typeof import("../../src/services/admin/user.service").UserService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/admin/user.service", () => ({
      UserService: {
        updateDailyDownloadLimit: jest.fn(),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ UserService } = await import("../../src/services/admin/user.service"));
  ({ ResponseError: ResponseErrorClass } = await import(
    "../../src/utils/response-error.util"
  ));
});

afterAll(async () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    await disconnectPrisma();
  }
});

describe("PATCH /admin/users/:id/daily-download-limit", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("updates daily download limit", async () => {
    const updateDailyDownloadLimitMock = jest.mocked(
      UserService.updateDailyDownloadLimit
    );
    updateDailyDownloadLimitMock.mockResolvedValue({
      id: validId,
      daily_download_limit: 25,
    } as never);

    const response = await request(app)
      .patch(`/admin/users/${validId}/daily-download-limit`)
      .set("Authorization", "Bearer admin-token")
      .send({ daily_download_limit: 25 });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: validId,
      daily_download_limit: 25,
    });
    expect(typeof response.body.data.daily_download_limit).toBe("number");
  });

  it("returns 403 for non-admin users", async () => {
    const response = await request(app)
      .patch(`/admin/users/${validId}/daily-download-limit`)
      .set("Authorization", "Bearer user-token")
      .send({ daily_download_limit: 25 });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns validation errors for invalid patch payloads", async () => {
    const updateDailyDownloadLimitMock = jest.mocked(
      UserService.updateDailyDownloadLimit
    );
    updateDailyDownloadLimitMock.mockRejectedValue(
      new ResponseErrorClass(400, "Validation error", {
        daily_download_limit: ["Number must be greater than or equal to 0"],
      }),
    );

    const response = await request(app)
      .patch(`/admin/users/${validId}/daily-download-limit`)
      .set("Authorization", "Bearer admin-token")
      .send({ daily_download_limit: -1 });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.daily_download_limit");
    expect(Array.isArray(response.body.errors.daily_download_limit)).toBe(true);
  });
});

describe("PATCH /admin/users/:id/daily-download-limit", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();

  afterEach(async () => {
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("updates daily download limit", async () => {
    const prisma = await loadPrisma();
    const { user: admin } = await createRealUser(
      "admin-users-daily-limit-admin",
      { role: "admin" }
    );
    const { user: target } = await createRealUser(
      "admin-users-daily-limit-target"
    );
    trackedEmails.add(admin.email);
    trackedEmails.add(target.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .patch(`/admin/users/${target.id}/daily-download-limit`)
      .set("Authorization", `Bearer ${token}`)
      .send({ daily_download_limit: 25 });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: target.id,
      daily_download_limit: 25,
    });

    const stored = await prisma.user.findUnique({ where: { id: target.id } });
    expect(stored?.dailyDownloadLimit).toBe(25);
  });

  it("returns 403 for non-admin users", async () => {
    const { user } = await createRealUser("admin-users-daily-limit-forbidden");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .patch(`/admin/users/${validId}/daily-download-limit`)
      .set("Authorization", `Bearer ${token}`)
      .send({ daily_download_limit: 25 });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns validation errors for invalid patch payloads", async () => {
    const { user: admin } = await createRealUser(
      "admin-users-daily-limit-invalid",
      { role: "admin" }
    );
    const { user: target } = await createRealUser(
      "admin-users-daily-limit-invalid-target"
    );
    trackedEmails.add(admin.email);
    trackedEmails.add(target.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .patch(`/admin/users/${target.id}/daily-download-limit`)
      .set("Authorization", `Bearer ${token}`)
      .send({ daily_download_limit: -1 });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.daily_download_limit");
    expect(Array.isArray(response.body.errors.daily_download_limit)).toBe(true);
  });
});
