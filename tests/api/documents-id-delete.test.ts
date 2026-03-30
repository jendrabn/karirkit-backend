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
        delete: jest.fn(),
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

describe("DELETE /documents/:id", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deletes the document resource", async () => {
    const deleteMock = jest.mocked(DocumentService.delete);
    deleteMock.mockResolvedValue(undefined as never);

    const response = await request(app)
      .delete(`/documents/${validId}`).set("Authorization", "Bearer pro-token");

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app)
      .delete(`/documents/${validId}`);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 404 when the document cannot be found", async () => {
    const deleteMock = jest.mocked(DocumentService.delete);
    deleteMock.mockRejectedValue(
      new ResponseErrorClass(404, "Document tidak ditemukan"),
    );

    const response = await request(app)
      .delete(`/documents/${validId}`).set("Authorization", "Bearer pro-token");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Document tidak ditemukan");
  });

  it("returns 403 for free users", async () => {
    const deleteMock = jest.mocked(DocumentService.delete);

    const response = await request(app)
      .delete(`/documents/${validId}`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe(
      "Fitur dokumen khusus untuk pengguna Pro atau Max"
    );
    expect(deleteMock).not.toHaveBeenCalled();
  });
});

describe("DELETE /documents/:id", () => {
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

  it("deletes the document resource", async () => {
    const { user } = await createRealUser("documents-delete", { planId: "pro" });
    trackedEmails.add(user.email);
    trackedUserIds.add(user.id);
    const token = await createSessionToken(user);
    const fixture = await createStoredDocumentFixture(user.id, {
      originalName: "delete-me.txt",
    });
    trackedDocumentIds.add(fixture.document.id);

    const response = await request(app)
      .delete(`/documents/${fixture.document.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    trackedDocumentIds.delete(fixture.document.id);
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app).delete(`/documents/${validId}`);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 404 when the document cannot be found", async () => {
    const { user } = await createRealUser("documents-delete-missing", {
      planId: "pro",
    });
    trackedEmails.add(user.email);
    trackedUserIds.add(user.id);
    const token = await createSessionToken(user);

    const response = await request(app)
      .delete(`/documents/${validId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body.errors.general[0]).toBe("Dokumen tidak ditemukan");
  });

  it("returns 403 for free users", async () => {
    const { user } = await createRealUser("documents-delete-free");
    trackedEmails.add(user.email);
    trackedUserIds.add(user.id);
    const token = await createSessionToken(user);

    const response = await request(app)
      .delete(`/documents/${validId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe(
      "Fitur dokumen khusus untuk pengguna Pro atau Max"
    );
  });
});
