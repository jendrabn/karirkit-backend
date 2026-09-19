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
        get: mock(() => {}),
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

describe("GET /cover-letters/:id", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    mock.clearAllMocks();
  });

  it("returns cover letter details", async () => {
    const getMock = CoverLetterService.get;
    getMock.mockResolvedValue({
      id: validId,
      name: "Cover Letter Detail",
    } as never);

    const response = await request(app)
      .get(`/cover-letters/${validId}`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: validId,
      name: "Cover Letter Detail",
    });
    expect(typeof response.body.data.id).toBe("string");
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app).get(`/cover-letters/${validId}`);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 404 when the cover letter does not exist", async () => {
    const getMock = CoverLetterService.get;
    getMock.mockRejectedValue(
      new ResponseErrorClass(404, "Cover Letter tidak ditemukan")
    );

    const response = await request(app)
      .get(`/cover-letters/${validId}`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe(
      "Cover Letter tidak ditemukan"
    );
  });
});

describe("GET /cover-letters/:id", () => {
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

  it("returns cover letter details", async () => {
    const { user } = await createRealUser("cover-letter-detail");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const template = await createRealTemplateFixture(
      "cover_letter",
      "app-letter-detail"
    );
    trackedTemplateIds.add(template.id);
    const letter = await createRealCoverLetterFixture(user.id, template.id, {
      name: "Cover Letter Detail",
    });
    trackedLetterIds.add(letter.id);

    const response = await request(app)
      .get(`/cover-letters/${letter.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: letter.id,
      user_id: user.id,
      name: "Cover Letter Detail",
      template_id: template.id,
    });
    expect(response.body.data.template).toMatchObject({
      id: template.id,
      type: "cover_letter",
    });
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app).get(`/cover-letters/${validId}`);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 404 when the cover letter does not exist", async () => {
    const { user } = await createRealUser("cover-letter-detail-missing");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .get("/cover-letters/550e8400-e29b-41d4-a716-446655440099")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Surat lamaran tidak ditemukan");
  });
});
