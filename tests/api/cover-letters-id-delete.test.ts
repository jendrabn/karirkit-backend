import request from "supertest";
import {
  createRealCoverLetterFixture,
  createRealTemplateFixture,
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
  loadPrisma,
} from "./real-mode";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";

const validId = "550e8400-e29b-41d4-a716-446655440000";

let app: typeof import("../../src/index").default;
let CoverLetterService: typeof import("../../src/services/cover-letter.service").CoverLetterService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
if (process.env.RUN_REAL_API_TESTS !== "true") {
    mock.module("../../src/services/cover-letter.service", () => ({
      CoverLetterService: {
        delete: mock(() => {}),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ CoverLetterService } = await import(
    "../../src/services/cover-letter.service"
  ));
  ({ ResponseError: ResponseErrorClass } = await import(
    "../../src/utils/response-error.util"
  ));
});

afterAll(async () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    await disconnectPrisma();
  }
});

describe("DELETE /cover-letters/:id", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    mock.clearAllMocks();
  });

  it("deletes the cover letter resource", async () => {
    const deleteMock = CoverLetterService.delete;
    deleteMock.mockResolvedValue(undefined as never);

    const response = await request(app)
      .delete(`/cover-letters/${validId}`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app).delete(`/cover-letters/${validId}`);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 404 when the cover letter cannot be found", async () => {
    const deleteMock = CoverLetterService.delete;
    deleteMock.mockRejectedValue(
      new ResponseErrorClass(404, "Surat lamaran tidak ditemukan")
    );

    const response = await request(app)
      .delete(`/cover-letters/${validId}`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Surat lamaran tidak ditemukan");
  });
});

describe("DELETE /cover-letters/:id", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();
  const trackedTemplateIds = new Set<string>();

  afterEach(async () => {
    const prisma = await loadPrisma();
    if (trackedTemplateIds.size > 0) {
      await prisma.template.deleteMany({
        where: { id: { in: [...trackedTemplateIds] } },
      });
    }
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
    trackedTemplateIds.clear();
  });

  it("deletes the cover letter resource", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("cover-letter-delete");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const template = await createRealTemplateFixture(
      "cover_letter",
      "app-letter-delete"
    );
    trackedTemplateIds.add(template.id);
    const letter = await createRealCoverLetterFixture(user.id, template.id);

    const response = await request(app)
      .delete(`/cover-letters/${letter.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(204);

    const deleted = await prisma.coverLetter.findUnique({
      where: { id: letter.id },
    });
    expect(deleted).toBeNull();
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app).delete(`/cover-letters/${validId}`);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 404 when the cover letter cannot be found", async () => {
    const { user } = await createRealUser("cover-letter-delete-missing");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .delete("/cover-letters/550e8400-e29b-41d4-a716-446655440099")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Surat lamaran tidak ditemukan");
  });
});
