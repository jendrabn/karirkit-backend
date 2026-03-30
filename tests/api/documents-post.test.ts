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
        createMerged: jest.fn(),
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

  it("merges multiple uploaded documents when merge is enabled", async () => {
    const createManyMock = jest.mocked(DocumentService.createMany);
    const createMergedMock = jest.mocked(DocumentService.createMerged);
    createMergedMock.mockResolvedValue({
      id: "document-merged",
      file_name: "merged.pdf",
    } as never);

    const response = await request(app)
      .post("/documents?merge=true")
      .set("Authorization", "Bearer pro-token")
      .attach("files", Buffer.from("fake-pdf-1"), {
        filename: "resume-1.pdf",
        contentType: "application/pdf",
      })
      .attach("files", Buffer.from("fake-pdf-2"), {
        filename: "resume-2.pdf",
        contentType: "application/pdf",
      });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      id: "document-merged",
      file_name: "merged.pdf",
    });
    expect(createMergedMock).toHaveBeenCalledTimes(1);
    expect(createManyMock).not.toHaveBeenCalled();
  });

  it("returns 403 for free users", async () => {
    const createMock = jest.mocked(DocumentService.create);

    const response = await request(app)
      .post("/documents")
      .set("Authorization", "Bearer user-token")
      .attach("file", Buffer.from("fake-pdf"), {
        filename: "resume.pdf",
        contentType: "application/pdf",
      });

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe(
      "Fitur dokumen khusus untuk pengguna Pro atau Max"
    );
    expect(createMock).not.toHaveBeenCalled();
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

  it("returns 400 for invalid merge options", async () => {
    const { user } = await createRealUser("documents-upload-invalid-merge", {
      planId: "pro",
    });
    trackedEmails.add(user.email);
    trackedUserIds.add(user.id);
    const token = await createSessionToken(user);

    const response = await request(app)
      .post("/documents?merge=maybe")
      .set("Authorization", `Bearer ${token}`)
      .field("type", "cv")
      .attach("file", Buffer.from("hello document"), {
        filename: "resume.txt",
        contentType: "text/plain",
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Opsi merge tidak dikenal");
  });

  it("returns 403 for free users", async () => {
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

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe(
      "Fitur dokumen khusus untuk pengguna Pro atau Max"
    );
  });
});
