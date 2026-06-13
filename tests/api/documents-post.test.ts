import request from "supertest";
import {
  createRealUser,
  createSessionToken,
  cleanupStoredDocumentFixture,
  cleanupStoredDocumentsForUser,
  deleteUsersByEmail,
  disconnectPrisma,
} from "./real-mode";

let app: typeof import("../../src/index").default;
let DocumentService: typeof import("../../src/services/document.service").DocumentService;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/document.service", () => ({
      DocumentService: {
        create: jest.fn(),
        createMany: jest.fn(),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ DocumentService } = await import("../../src/services/document.service"));
});

afterAll(async () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    await disconnectPrisma();
  }
});

describe("POST /documents", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uploads a single document for the authenticated user", async () => {
    const createMock = jest.mocked(DocumentService.create);
    createMock.mockResolvedValue({
      id: "document-1",
      file_name: "resume.pdf",
    } as never);

    const response = await request(app)
      .post("/documents")
      .set("Authorization", "Bearer pro-token")
      .attach("file", Buffer.from("fake-pdf"), {
        filename: "resume.pdf",
        contentType: "application/pdf",
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: "document-1",
      file_name: "resume.pdf",
    });
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).post("/documents");

    expect(response.status).toBe(401);
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("uploads multiple documents from file[] fields", async () => {
    const createManyMock = jest.mocked(DocumentService.createMany);
    createManyMock.mockResolvedValue([
      {
        id: "document-1",
        file_name: "resume-1.pdf",
      },
      {
        id: "document-2",
        file_name: "resume-2.pdf",
      },
    ] as never);

    const response = await request(app)
      .post("/documents")
      .set("Authorization", "Bearer pro-token")
      .attach("file[]", Buffer.from("fake-pdf-1"), {
        filename: "resume-1.pdf",
        contentType: "application/pdf",
      })
      .attach("file[]", Buffer.from("fake-pdf-2"), {
        filename: "resume-2.pdf",
        contentType: "application/pdf",
      });

    expect(response.status).toBe(201);
    expect(response.body.data).toHaveLength(2);
    expect(createManyMock).toHaveBeenCalledTimes(1);
  });

  it("rejects legacy files fields", async () => {
    const pngBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);

    const response = await request(app)
      .post("/documents")
      .set("Authorization", "Bearer pro-token")
      .attach("files", pngBuffer, {
        filename: "photo-1.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(400);
    expect(response.body.errors.general[0]).toBe(
      "Field file tidak valid. Gunakan file atau file[]"
    );
  });

  it("rejects requests mixing file and file[] fields", async () => {
    const pngBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);

    const response = await request(app)
      .post("/documents?compression=strong")
      .set("Authorization", "Bearer pro-token")
      .attach("file", pngBuffer, {
        filename: "photo-1.png",
        contentType: "image/png",
      })
      .attach("file[]", pngBuffer, {
        filename: "photo-2.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(400);
    expect(response.body.errors.general[0]).toBe(
      "Gunakan salah satu field file atau file[], tidak keduanya"
    );
  });

  it("allows free users to upload documents", async () => {
    const createMock = jest.mocked(DocumentService.create);
    createMock.mockResolvedValue({
      id: "document-free",
      file_name: "resume.pdf",
    } as never);

    const response = await request(app)
      .post("/documents")
      .set("Authorization", "Bearer user-token")
      .attach("file", Buffer.from("fake-pdf"), {
        filename: "resume.pdf",
        contentType: "application/pdf",
      });

    expect(response.status).toBe(201);
    expect(createMock).toHaveBeenCalledTimes(1);
  });
});

describe("POST /documents", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();
  const trackedUserIds = new Set<string>();
  const trackedDocumentIds = new Set<string>();

  afterEach(async () => {
    for (const documentId of trackedDocumentIds) {
      await cleanupStoredDocumentFixture(documentId);
    }
    trackedDocumentIds.clear();
    for (const userId of trackedUserIds) {
      await cleanupStoredDocumentsForUser(userId);
    }
    trackedUserIds.clear();
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("uploads a single document for the authenticated user", async () => {
    const { user } = await createRealUser("documents-upload", { planId: "pro" });
    trackedEmails.add(user.email);
    trackedUserIds.add(user.id);
    const token = await createSessionToken(user);

    const response = await request(app)
      .post("/documents")
      .set("Authorization", `Bearer ${token}`)
      .field("type", "cv")
      .field("name", "resume.txt")
      .attach("file", Buffer.from("hello document"), {
        filename: "resume.txt",
        contentType: "text/plain",
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      user_id: user.id,
      type: "cv",
      original_name: "resume.txt",
      mime_type: "text/plain",
    });
    expect(typeof response.body.data.id).toBe("string");
    trackedDocumentIds.add(response.body.data.id);
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).post("/documents");

    expect(response.status).toBe(401);
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 400 for removed auto compression option", async () => {
    const { user } = await createRealUser("documents-upload-invalid-compression", {
      planId: "pro",
    });
    trackedEmails.add(user.email);
    trackedUserIds.add(user.id);
    const token = await createSessionToken(user);

    const response = await request(app)
      .post("/documents?compression=auto")
      .set("Authorization", `Bearer ${token}`)
      .field("type", "cv")
      .attach("file", Buffer.from("hello document"), {
        filename: "resume.txt",
        contentType: "text/plain",
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe(
      "Opsi kompresi tidak dikenal. Pilihan: light, medium, strong"
    );
  });

  it("allows free users to upload documents", async () => {
    const { user } = await createRealUser("documents-upload-free");
    trackedEmails.add(user.email);
    trackedUserIds.add(user.id);
    const token = await createSessionToken(user);

    const response = await request(app)
      .post("/documents")
      .set("Authorization", `Bearer ${token}`)
      .field("type", "cv")
      .attach("file", Buffer.from("hello document"), {
        filename: "resume.txt",
        contentType: "text/plain",
      });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      user_id: user.id,
      type: "cv",
      mime_type: "text/plain",
    });
    trackedDocumentIds.add(response.body.data.id);
  });
});
