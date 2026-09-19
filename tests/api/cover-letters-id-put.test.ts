import request from "supertest";
import {
  buildCoverLetterPayload,
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
        update: mock(() => {}),
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

describe("PUT /cover-letters/:id", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    mock.clearAllMocks();
  });

  it("updates a cover letter record", async () => {
    const updateMock = CoverLetterService.update;
    updateMock.mockResolvedValue({
      id: validId,
      name: "Cover Letter Diperbarui",
    } as never);

    const response = await request(app)
      .put(`/cover-letters/${validId}`)
      .set("Authorization", "Bearer user-token")
      .send({ name: "Cover Letter Diperbarui" });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: validId,
      name: "Cover Letter Diperbarui",
    });
    expect(typeof response.body.data.name).toBe("string");
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app)
      .put(`/cover-letters/${validId}`)
      .send({ name: "Cover Letter Diperbarui" });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns validation errors for invalid updates", async () => {
    const updateMock = CoverLetterService.update;
    updateMock.mockRejectedValue(
      new ResponseErrorClass(400, "Payload tidak valid")
    );

    const response = await request(app)
      .put(`/cover-letters/${validId}`)
      .set("Authorization", "Bearer user-token")
      .send({ name: "" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Payload tidak valid");
  });
});

describe("PUT /cover-letters/:id", () => {
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

  it("updates a cover letter record", async () => {
    const { user } = await createRealUser("cover-letter-update");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const template = await createRealTemplateFixture(
      "cover_letter",
      "app-letter-update"
    );
    trackedTemplateIds.add(template.id);
    const letter = await createRealCoverLetterFixture(user.id, template.id);
    trackedLetterIds.add(letter.id);

    const response = await request(app)
      .put(`/cover-letters/${letter.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send(
        buildCoverLetterPayload(template.id, {
          name: "Cover Letter Diperbarui",
          company_name: "PT Karirkit Updated",
          email: user.email,
        })
      );

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: letter.id,
      name: "Cover Letter Diperbarui",
      company_name: "PT Karirkit Updated",
      template_id: template.id,
    });
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app)
      .put(`/cover-letters/${validId}`)
      .send({ name: "Cover Letter Diperbarui" });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns validation errors for invalid updates", async () => {
    const { user } = await createRealUser("cover-letter-update-invalid");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const template = await createRealTemplateFixture(
      "cover_letter",
      "app-letter-update-invalid"
    );
    trackedTemplateIds.add(template.id);
    const letter = await createRealCoverLetterFixture(user.id, template.id);
    trackedLetterIds.add(letter.id);

    const response = await request(app)
      .put(`/cover-letters/${letter.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send(
        buildCoverLetterPayload(template.id, {
          name: "",
          email: "invalid-email",
        })
      );

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.name");
    expect(response.body).toHaveProperty("errors.email");
  });
});
