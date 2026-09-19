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
let prismaMock: typeof import("../../src/config/prisma.config").prisma;

beforeAll(async () => {
if (process.env.RUN_REAL_API_TESTS !== "true") {
    mock.module("../../src/config/prisma.config", () => ({
      prisma: {
        coverLetter: { count: mock(() => {}) },
      },
    }));
    mock.module("../../src/services/cover-letter.service", () => ({
      CoverLetterService: {
        duplicate: mock(() => {}),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ prisma: prismaMock } = await import("../../src/config/prisma.config"));
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

describe("POST /cover-letters/:id/duplicate", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  const getPrisma = () =>
    prismaMock as unknown as {
      coverLetter: { count: Mock };
    };

  beforeEach(() => {
    mock.clearAllMocks();
    getPrisma().coverLetter.count.mockResolvedValue(0);
  });

  it("duplicates the cover letter record", async () => {
    const duplicateMock = CoverLetterService.duplicate;
    duplicateMock.mockResolvedValue({
      id: "660e8400-e29b-41d4-a716-446655440000",
      name: "Cover Letter Salinan",
    } as never);

    const response = await request(app)
      .post(`/cover-letters/${validId}/duplicate`)
      .set("Authorization", "Bearer pro-token");

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: "660e8400-e29b-41d4-a716-446655440000",
      name: "Cover Letter Salinan",
    });
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).post(
      `/cover-letters/${validId}/duplicate`
    );

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 404 when the cover letter cannot be duplicated", async () => {
    const duplicateMock = CoverLetterService.duplicate;
    duplicateMock.mockRejectedValue(
      new ResponseErrorClass(404, "Surat lamaran tidak ditemukan")
    );

    const response = await request(app)
      .post(`/cover-letters/${validId}/duplicate`)
      .set("Authorization", "Bearer pro-token");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Surat lamaran tidak ditemukan");
  });

  it("allows duplication for free users", async () => {
    const duplicateMock = CoverLetterService.duplicate;
    duplicateMock.mockResolvedValue({
      id: "660e8400-e29b-41d4-a716-446655440000",
      name: "Cover Letter Salinan",
    } as never);

    const response = await request(app)
      .post(`/cover-letters/${validId}/duplicate`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      id: "660e8400-e29b-41d4-a716-446655440000",
      name: "Cover Letter Salinan",
    });
  });

  it("blocks duplication for admins when their plan cover letter limit is reached", async () => {
    const prisma = getPrisma();
    prisma.coverLetter.count.mockResolvedValue(20);

    const response = await request(app)
      .post(`/cover-letters/${validId}/duplicate`)
      .set("Authorization", "Bearer admin-free-token");

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe(
      "Batas maksimum surat lamaran telah tercapai"
    );
    expect(response.body.code).toBe("COVER_LETTER_LIMIT_REACHED");
  });
});

describe("POST /cover-letters/:id/duplicate", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();
  const trackedTemplateIds = new Set<string>();
  const trackedLetterIds = new Set<string>();

  afterEach(async () => {
    const prisma = await loadPrisma();
    if (trackedLetterIds.size > 0) {
      await prisma.coverLetter.deleteMany({
        where: { id: { in: [...trackedLetterIds] } },
      });
    }
    if (trackedTemplateIds.size > 0) {
      await prisma.template.deleteMany({
        where: { id: { in: [...trackedTemplateIds] } },
      });
    }
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
    trackedTemplateIds.clear();
    trackedLetterIds.clear();
  });

  it("duplicates the cover letter record", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("cover-letter-duplicate", {
      planId: "pro",
    });
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const template = await createRealTemplateFixture(
      "cover_letter",
      "app-letter-duplicate"
    );
    trackedTemplateIds.add(template.id);
    const source = await createRealCoverLetterFixture(user.id, template.id, {
      name: "Cover Letter Source",
    });
    trackedLetterIds.add(source.id);

    const response = await request(app)
      .post(`/cover-letters/${source.id}/duplicate`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      name: "Cover Letter Source",
      user_id: user.id,
      template_id: template.id,
    });
    expect(response.body.data.id).not.toBe(source.id);
    trackedLetterIds.add(response.body.data.id);

    const total = await prisma.coverLetter.count({
      where: { userId: user.id },
    });
    expect(total).toBe(2);
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).post(
      `/cover-letters/${validId}/duplicate`
    );

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 404 when the cover letter cannot be duplicated", async () => {
    const { user } = await createRealUser(
      "cover-letter-duplicate-missing",
      {
        planId: "pro",
      }
    );
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .post("/cover-letters/550e8400-e29b-41d4-a716-446655440099/duplicate")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Surat lamaran tidak ditemukan");
  });
});
