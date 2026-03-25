import request from "supertest";
import {
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
  loadPrisma,
} from "./real-mode";

const tinyPngBuffer = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+XGN0AAAAASUVORK5CYII=",
  "base64"
);

let app: typeof import("../../src/index").default;
let AccountService: typeof import("../../src/services/account.service").AccountService;
let UploadService: typeof import("../../src/services/upload.service").UploadService;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/account.service", () => ({
      AccountService: {
        updateMe: jest.fn(),
      },
    }));
    jest.doMock("../../src/services/upload.service", () => ({
      UploadService: {
        uploadFile: jest.fn(),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ AccountService } = await import("../../src/services/account.service"));
  ({ UploadService } = await import("../../src/services/upload.service"));
});

afterAll(async () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    await disconnectPrisma();
  }
});

describe("PUT /account/me", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("updates the authenticated profile and uploads the avatar when present", async () => {
    const updateMeMock = jest.mocked(AccountService.updateMe);
    const uploadFileMock = jest.mocked(UploadService.uploadFile);
    uploadFileMock.mockResolvedValue({
      path: "/uploads/temp/avatar.webp",
      original_name: "avatar.png",
      size: 120,
      mime_type: "image/webp",
    } as never);
    updateMeMock.mockResolvedValue({
      id: "user-1",
      username: "user",
      avatar: "/uploads/avatars/avatar.webp",
      social_links: [
        {
          id: "link-1",
          user_id: "user-1",
          platform: "linkedin",
          url: "https://linkedin.com/in/user",
        },
      ],
    } as never);

    const response = await request(app)
      .put("/account/me")
      .set("Authorization", "Bearer user-token")
      .field("username", "user")
      .field(
        "social_links",
        JSON.stringify([
          { platform: "linkedin", url: "https://linkedin.com/in/user" },
        ])
      )
      .attach("file", tinyPngBuffer, {
        filename: "avatar.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: "user-1",
      username: "user",
      avatar: "/uploads/avatars/avatar.webp",
    });
    expect(Array.isArray(response.body.data.social_links)).toBe(true);
    expect(uploadFileMock).toHaveBeenCalledTimes(1);
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).put("/account/me").send({
      username: "user",
    });

    expect(response.status).toBe(401);
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 400 when social_links is not valid JSON", async () => {
    const response = await request(app)
      .put("/account/me")
      .set("Authorization", "Bearer user-token")
      .field("username", "user")
      .field("social_links", "{invalid-json}");

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe(
      "Format social_links tidak valid"
    );
  });
});

describe("PUT /account/me", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();
  const uploadedPaths = new Set<string>();

  afterEach(async () => {
    for (const uploadedPath of uploadedPaths) {
      await UploadService.deleteUpload(uploadedPath, [
        "uploads/avatars",
        "uploads/temp",
      ]);
    }
    uploadedPaths.clear();
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("updates the authenticated profile and uploads the avatar when present", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("account-update");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .put("/account/me")
      .set("Authorization", `Bearer ${token}`)
      .field("name", "Updated User")
      .field("username", `updated-${Date.now()}`)
      .field("headline", "Senior Engineer")
      .field("birth_date", "1998-01-01")
      .field(
        "social_links",
        JSON.stringify([
          { platform: "linkedin", url: "https://linkedin.com/in/updated-user" },
        ])
      )
      .attach("file", tinyPngBuffer, {
        filename: "avatar.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: user.id,
      name: "Updated User",
      headline: "Senior Engineer",
    });
    expect(response.body.data.avatar).toContain("/uploads/avatars/");
    expect(Array.isArray(response.body.data.social_links)).toBe(true);
    expect(response.body.data.social_links[0]).toMatchObject({
      platform: "linkedin",
      url: "https://linkedin.com/in/updated-user",
    });
    uploadedPaths.add(response.body.data.avatar);

    const storedUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(storedUser?.avatar).toContain("/uploads/avatars/");
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).put("/account/me").send({
      username: "user",
    });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 400 when social_links is not valid JSON", async () => {
    const { user } = await createRealUser("account-update-invalid-json");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .put("/account/me")
      .set("Authorization", `Bearer ${token}`)
      .field("username", "updated-user")
      .field("social_links", "{invalid-json}");

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe(
      "Format social_links tidak valid"
    );
  });
});
