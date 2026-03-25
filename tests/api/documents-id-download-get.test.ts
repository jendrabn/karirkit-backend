import request from "supertest";
import {
  createRealUser,
  createSessionToken,
  createStoredDocumentFixture,
  cleanupStoredDocumentFixture,
  cleanupStoredDocumentsForUser,
  deleteUsersByEmail,
  disconnectPrisma,
} from "./real-mode";

const validId = "550e8400-e29b-41d4-a716-446655440000";
let app: typeof import("../../src/index").default;
let DocumentService: typeof import("../../src/services/document.service").DocumentService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/document.service", () => ({
      DocumentService: {
        download: jest.fn(),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ DocumentService } = await import("../../src/services/document.service"));
  ({ ResponseError: ResponseErrorClass } = await import(
    "../../src/utils/response-error.util"
  ));
});

afterAll(async () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    await disconnectPrisma();
  }
});

describe("GET /documents/:id/download", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("downloads a stored document", async () => {
    const downloadMock = jest.mocked(DocumentService.download);
    downloadMock.mockResolvedValue({
      fileName: "resume.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("pdf-content"),
    } as never);

    const response = await request(app)
      .get(`/documents/${validId}/download`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/pdf");
    expect(response.headers["content-disposition"]).toContain("attachment;");
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).get(`/documents/${validId}/download`);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 404 when the document does not exist", async () => {
    const downloadMock = jest.mocked(DocumentService.download);
    downloadMock.mockRejectedValue(
      new ResponseErrorClass(404, "Dokumen tidak ditemukan"),
    );

    const response = await request(app)
      .get(`/documents/${validId}/download`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Dokumen tidak ditemukan");
  });
});

describe("GET /documents/:id/download", () => {
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

  it("downloads a stored document", async () => {
    const { user } = await createRealUser("documents-download");
    trackedEmails.add(user.email);
    trackedUserIds.add(user.id);
    const token = await createSessionToken(user);
    const fixture = await createStoredDocumentFixture(user.id, {
      originalName: "resume.txt",
      mimeType: "text/plain",
      content: Buffer.from("download me"),
    });
    trackedDocumentIds.add(fixture.document.id);

    const response = await request(app)
      .get(`/documents/${fixture.document.id}/download`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/plain");
    expect(response.headers["content-disposition"]).toContain("attachment;");
    expect(response.text).toBe("download me");
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).get(`/documents/${validId}/download`);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 404 when the document belongs to another user", async () => {
    const { user } = await createRealUser("documents-download-owner");
    const { user: otherUser } = await createRealUser("documents-download-other");
    trackedEmails.add(user.email);
    trackedEmails.add(otherUser.email);
    trackedUserIds.add(user.id);
    trackedUserIds.add(otherUser.id);
    const token = await createSessionToken(user);
    const fixture = await createStoredDocumentFixture(otherUser.id, {
      originalName: "private.txt",
    });
    trackedDocumentIds.add(fixture.document.id);

    const response = await request(app)
      .get(`/documents/${fixture.document.id}/download`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Dokumen tidak ditemukan");
  });
});
