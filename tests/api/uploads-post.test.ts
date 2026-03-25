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
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

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
  ({ ResponseError: ResponseErrorClass } = await import(
    "../../src/utils/response-error.util"
  ));
});

afterAll(async () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    await disconnectPrisma();
  }
});

describe("POST /uploads", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uploads a temporary file for authenticated users", async () => {
    const uploadFileMock = jest.mocked(UploadService.uploadFile);
    uploadFileMock.mockResolvedValue({
      path: "/uploads/temp/avatar.webp",
      original_name: "avatar.png",
      size: 123,
      mime_type: "image/webp",
    } as never);

    const response = await request(app)
      .post("/uploads?quality=90&webp=true")
      .set("Authorization", "Bearer user-token")
      .attach("file", tinyPngBuffer, {
        filename: "avatar.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      path: "/uploads/temp/avatar.webp",
      original_name: "avatar.png",
      mime_type: "image/webp",
    });
    expect(typeof response.body.data.size).toBe("number");
  });

  it("returns 401 when upload is requested without authentication", async () => {
    const response = await request(app).post("/uploads");

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 400 when the file is missing", async () => {
    const uploadFileMock = jest.mocked(UploadService.uploadFile);
    uploadFileMock.mockRejectedValue(
      new ResponseErrorClass(400, "File diperlukan")
    );

    const response = await request(app)
      .post("/uploads")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("File diperlukan");
  });
});

describe("POST /uploads", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();
  const uploadedPaths = new Set<string>();

  afterEach(async () => {
    for (const uploadedPath of uploadedPaths) {
      await UploadService.deleteUpload(uploadedPath, ["uploads/temp"]);
    }
    uploadedPaths.clear();
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("uploads a temporary file for authenticated users", async () => {
    const { user } = await createRealUser("temp-upload");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .post("/uploads?quality=90&webp=true")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", tinyPngBuffer, {
        filename: "avatar.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      original_name: "avatar.png",
      mime_type: "image/webp",
    });
    expect(typeof response.body.data.size).toBe("number");
    expect(response.body.data.path).toContain("/uploads/temp/");
    uploadedPaths.add(response.body.data.path);
  });

  it("returns 401 when upload is requested without authentication", async () => {
    const response = await request(app).post("/uploads");

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 400 when the file is missing", async () => {
    const { user } = await createRealUser("temp-upload-missing");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .post("/uploads")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("File diperlukan");
  });
});
