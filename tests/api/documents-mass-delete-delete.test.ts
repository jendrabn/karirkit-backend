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
        massDelete: jest.fn(),
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

describe("DELETE /documents/mass-delete", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deletes multiple document records", async () => {
    const massDeleteMock = jest.mocked(DocumentService.massDelete);
    massDeleteMock.mockResolvedValue({ deleted_count: 2, ids: ["550e8400-e29b-41d4-a716-446655440000", "660e8400-e29b-41d4-a716-446655440000"] } as never);

    const response = await request(app)
      .delete("/documents/mass-delete").set("Authorization", "Bearer pro-token")
      .send({ ids: ["550e8400-e29b-41d4-a716-446655440000", "660e8400-e29b-41d4-a716-446655440000"] });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({ deleted_count: 2, ids: ["550e8400-e29b-41d4-a716-446655440000", "660e8400-e29b-41d4-a716-446655440000"] });
    expect(typeof response.body.data.deleted_count).toBe("number");
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app)
      .delete("/documents/mass-delete")
      .send({ ids: ["550e8400-e29b-41d4-a716-446655440000"] });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns validation errors when no ids are provided", async () => {
    const massDeleteMock = jest.mocked(DocumentService.massDelete);
    massDeleteMock.mockRejectedValue(
      new ResponseErrorClass(400, "Minimal satu data harus dipilih"),
    );

    const response = await request(app)
      .delete("/documents/mass-delete").set("Authorization", "Bearer pro-token")
      .send({ ids: [] });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Minimal satu data harus dipilih");
  });

  it("returns 403 for free users", async () => {
    const massDeleteMock = jest.mocked(DocumentService.massDelete);

    const response = await request(app)
      .delete("/documents/mass-delete")
      .set("Authorization", "Bearer user-token")
      .send({ ids: [validId] });

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe(
      "Fitur dokumen khusus untuk pengguna Pro atau Max"
    );
    expect(massDeleteMock).not.toHaveBeenCalled();
  });
});

describe("DELETE /documents/mass-delete", () => {
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

  it("deletes multiple document records", async () => {
    const { user } = await createRealUser("documents-mass-delete", {
      planId: "pro",
    });
    trackedEmails.add(user.email);
    trackedUserIds.add(user.id);
    const token = await createSessionToken(user);
    const first = await createStoredDocumentFixture(user.id, {
      originalName: "first.txt",
    });
    const second = await createStoredDocumentFixture(user.id, {
      originalName: "second.txt",
    });
    trackedDocumentIds.add(first.document.id);
    trackedDocumentIds.add(second.document.id);

    const response = await request(app)
      .delete("/documents/mass-delete")
      .set("Authorization", `Bearer ${token}`)
      .send({ ids: [first.document.id, second.document.id] });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data.deleted_count).toBe(2);
    expect(response.body.data.message).toBe("2 dokumen berhasil dihapus");
    trackedDocumentIds.delete(first.document.id);
    trackedDocumentIds.delete(second.document.id);
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app)
      .delete("/documents/mass-delete")
      .send({ ids: [validId] });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns validation errors when no ids are provided", async () => {
    const { user } = await createRealUser("documents-mass-delete-empty", {
      planId: "pro",
    });
    trackedEmails.add(user.email);
    trackedUserIds.add(user.id);
    const token = await createSessionToken(user);

    const response = await request(app)
      .delete("/documents/mass-delete")
      .set("Authorization", `Bearer ${token}`)
      .send({ ids: [] });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.ids");
    expect(Array.isArray(response.body.errors.ids)).toBe(true);
  });

  it("returns 403 for free users", async () => {
    const { user } = await createRealUser("documents-mass-delete-free");
    trackedEmails.add(user.email);
    trackedUserIds.add(user.id);
    const token = await createSessionToken(user);

    const response = await request(app)
      .delete("/documents/mass-delete")
      .set("Authorization", `Bearer ${token}`)
      .send({ ids: [validId] });

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe(
      "Fitur dokumen khusus untuk pengguna Pro atau Max"
    );
  });
});
