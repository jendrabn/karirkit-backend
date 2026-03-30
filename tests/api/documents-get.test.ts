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

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/document.service", () => ({
      DocumentService: {
        list: jest.fn(),
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

describe("GET /documents", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a paginated document list", async () => {
    const listMock = jest.mocked(DocumentService.list);
    listMock.mockResolvedValue({
      items: [{ id: validId, name: "Document 1" }],
      meta: { page: 1, per_page: 20, total: 1 },
    } as never);

    const response = await request(app)
      .get("/documents").set("Authorization", "Bearer pro-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body).toHaveProperty("data.meta");
    expect(Array.isArray(response.body.data.items)).toBe(true);
    expect(response.body.data.items[0]).toMatchObject({ id: validId, name: "Document 1" });
    expect(typeof response.body.data.meta.total).toBe("number");
  });

  it("returns 401 when the request is unauthenticated", async () => {
    
    const response = await request(app)
      .get("/documents");

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("supports an empty document state", async () => {
    const listMock = jest.mocked(DocumentService.list);
    listMock.mockResolvedValue({ items: [], meta: { page: 1, per_page: 20, total: 0 } } as never);

    const response = await request(app)
      .get("/documents").set("Authorization", "Bearer pro-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body.data.items).toEqual([]);
    expect(response.body.data.meta.total).toBe(0);
  });

  it("returns 403 for free users", async () => {
    const listMock = jest.mocked(DocumentService.list);

    const response = await request(app)
      .get("/documents")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe(
      "Fitur dokumen khusus untuk pengguna Pro atau Max"
    );
    expect(listMock).not.toHaveBeenCalled();
  });

  it("also returns 403 for admins on free plan", async () => {
    const listMock = jest.mocked(DocumentService.list);

    const response = await request(app)
      .get("/documents")
      .set("Authorization", "Bearer admin-free-token");

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe(
      "Fitur dokumen khusus untuk pengguna Pro atau Max"
    );
    expect(listMock).not.toHaveBeenCalled();
  });
});

describe("GET /documents", () => {
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

  it("returns a paginated document list", async () => {
    const { user } = await createRealUser("documents-list", { planId: "pro" });
    trackedEmails.add(user.email);
    trackedUserIds.add(user.id);
    const token = await createSessionToken(user);
    const first = await createStoredDocumentFixture(user.id, {
      originalName: "resume.txt",
    });
    const second = await createStoredDocumentFixture(user.id, {
      type: "sertifikat",
      originalName: "certificate.txt",
    });
    trackedDocumentIds.add(first.document.id);
    trackedDocumentIds.add(second.document.id);

    const response = await request(app)
      .get("/documents?sort_by=created_at&sort_order=desc")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body).toHaveProperty("data.pagination");
    expect(Array.isArray(response.body.data.items)).toBe(true);
    expect(response.body.data.items.length).toBeGreaterThanOrEqual(2);
    expect(response.body.data.items[0]).toHaveProperty("id");
    expect(response.body.data.pagination.total_items).toBeGreaterThanOrEqual(2);
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).get("/documents");

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("supports an empty document state", async () => {
    const { user } = await createRealUser("documents-list-empty", {
      planId: "pro",
    });
    trackedEmails.add(user.email);
    trackedUserIds.add(user.id);
    const token = await createSessionToken(user);

    const response = await request(app)
      .get("/documents?type=cv")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body.data.items).toEqual([]);
    expect(response.body.data.pagination.total_items).toBe(0);
  });

  it("returns 403 for free users", async () => {
    const { user } = await createRealUser("documents-list-free");
    trackedEmails.add(user.email);
    trackedUserIds.add(user.id);
    const token = await createSessionToken(user);

    const response = await request(app)
      .get("/documents")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe(
      "Fitur dokumen khusus untuk pengguna Pro atau Max"
    );
  });
});
