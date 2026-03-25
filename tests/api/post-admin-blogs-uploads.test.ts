import request from "supertest";
import {
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
} from "./real-mode";

const tinyPngBuffer = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+XGN0AAAAASUVORK5CYII=",
  "base64"
);

let app: typeof import("../../src/index").default;
let UploadService: typeof import("../../src/services/upload.service").UploadService;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/upload.service", () => ({
      UploadService: {
        uploadFile: jest.fn(),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ UploadService } = await import("../../src/services/upload.service"));
});

afterAll(async () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    await disconnectPrisma();
  }
});

describe("POST /admin/blogs/uploads", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uploads a blog image for admin users", async () => {
    const uploadFileMock = jest.mocked(UploadService.uploadFile);
    uploadFileMock.mockResolvedValue({
      path: "/uploads/blogs/hero.webp",
      original_name: "hero.png",
      size: 123,
      mime_type: "image/webp",
    } as never);

    const response = await request(app)
      .post("/admin/blogs/uploads")
      .set("Authorization", "Bearer admin-token")
      .attach("file", tinyPngBuffer, {
        filename: "hero.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      path: "/uploads/blogs/hero.webp",
      original_name: "hero.png",
      mime_type: "image/webp",
    });
  });

  it("returns 403 for non-admin users", async () => {
    const response = await request(app)
      .post("/admin/blogs/uploads")
      .set("Authorization", "Bearer user-token")
      .attach("file", tinyPngBuffer, {
        filename: "hero.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the upload file is missing", async () => {
    const response = await request(app)
      .post("/admin/blogs/uploads")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(400);
    expect(response.body.errors.general[0]).toBe("File diperlukan");
  });
});

describe("POST /admin/blogs/uploads", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();
  const uploadedPaths = new Set<string>();

  afterEach(async () => {
    for (const uploadedPath of uploadedPaths) {
      await UploadService.deleteUpload(uploadedPath, ["uploads/blogs"]);
    }
    uploadedPaths.clear();
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("uploads a blog image for admin users", async () => {
    const { user: admin } = await createRealUser("admin-blog-upload", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .post("/admin/blogs/uploads")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", tinyPngBuffer, {
        filename: "hero.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      original_name: "hero.png",
      mime_type: "image/webp",
    });
    expect(response.body.data.path).toContain("/uploads/blogs/");
    uploadedPaths.add(response.body.data.path);
  });

  it("returns 403 for non-admin users", async () => {
    const { user } = await createRealUser("admin-blog-upload-forbidden");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .post("/admin/blogs/uploads")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", tinyPngBuffer, {
        filename: "hero.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the upload file is missing", async () => {
    const { user: admin } = await createRealUser("admin-blog-upload-missing", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .post("/admin/blogs/uploads")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("File diperlukan");
  });
});
