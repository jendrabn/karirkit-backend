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

let app: typeof import("../../src/index").default;
let CoverLetterService: typeof import("../../src/services/cover-letter.service").CoverLetterService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
if (process.env.RUN_REAL_API_TESTS !== "true") {
    mock.module("../../src/services/cover-letter.service", () => ({
      CoverLetterService: {
        massDelete: mock(() => {}),
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

describe("DELETE /cover-letters/mass-delete", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    mock.clearAllMocks();
  });

  it("deletes multiple cover letter records", async () => {
    const massDeleteMock = CoverLetterService.massDelete;
    massDeleteMock.mockResolvedValue({
      deleted_count: 2,
      ids: [
        "550e8400-e29b-41d4-a716-446655440000",
        "660e8400-e29b-41d4-a716-446655440000",
      ],
    } as never);

    const response = await request(app)
      .delete("/cover-letters/mass-delete")
      .set("Authorization", "Bearer user-token")
      .send({
        ids: [
          "550e8400-e29b-41d4-a716-446655440000",
          "660e8400-e29b-41d4-a716-446655440000",
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      deleted_count: 2,
      ids: [
        "550e8400-e29b-41d4-a716-446655440000",
        "660e8400-e29b-41d4-a716-446655440000",
      ],
    });
    expect(typeof response.body.data.deleted_count).toBe("number");
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app)
      .delete("/cover-letters/mass-delete")
      .send({ ids: ["550e8400-e29b-41d4-a716-446655440000"] });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns validation errors when no ids are provided", async () => {
    const massDeleteMock = CoverLetterService.massDelete;
    massDeleteMock.mockRejectedValue(
      new ResponseErrorClass(400, "Minimal satu data harus dipilih")
    );

    const response = await request(app)
      .delete("/cover-letters/mass-delete")
      .set("Authorization", "Bearer user-token")
      .send({ ids: [] });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Minimal satu data harus dipilih");
  });
});

describe("DELETE /cover-letters/mass-delete", () => {
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

  it("deletes multiple cover letter records", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("cover-letter-mass-delete");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const template = await createRealTemplateFixture(
      "cover_letter",
      "app-letter-mass-delete"
    );
    trackedTemplateIds.add(template.id);
    const letterOne = await createRealCoverLetterFixture(user.id, template.id);
    const letterTwo = await createRealCoverLetterFixture(user.id, template.id);

    const response = await request(app)
      .delete("/cover-letters/mass-delete")
      .set("Authorization", `Bearer ${token}`)
      .send({ ids: [letterOne.id, letterTwo.id] });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data.deleted_count).toBe(2);

    const remaining = await prisma.coverLetter.findMany({
      where: { id: { in: [letterOne.id, letterTwo.id] } },
    });
    expect(remaining).toHaveLength(0);
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app)
      .delete("/cover-letters/mass-delete")
      .send({ ids: ["550e8400-e29b-41d4-a716-446655440000"] });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns errors when one of the ids is missing", async () => {
    const { user } = await createRealUser("cover-letter-mass-delete-missing");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const template = await createRealTemplateFixture(
      "cover_letter",
      "app-letter-mass-delete-missing"
    );
    trackedTemplateIds.add(template.id);
    const letter = await createRealCoverLetterFixture(user.id, template.id);
    trackedLetterIds.add(letter.id);

    const response = await request(app)
      .delete("/cover-letters/mass-delete")
      .set("Authorization", `Bearer ${token}`)
      .send({ ids: [letter.id, "550e8400-e29b-41d4-a716-446655440099"] });

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe(
      "Beberapa surat lamaran tidak ditemukan atau bukan milik Anda"
    );
  });
});
