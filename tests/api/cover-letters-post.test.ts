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

let app: typeof import("../../src/index").default;
let CoverLetterService: typeof import("../../src/services/cover-letter.service").CoverLetterService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;
let prismaMock: typeof import("../../src/config/prisma.config").prisma;

beforeAll(async () => {
if (process.env.RUN_REAL_API_TESTS !== "true") {
    mock.module("../../src/config/prisma.config", () => ({
      prisma: {
        coverLetter: { count: mock(() => {}) },
        template: { findUnique: mock(() => {}) },
      },
    }));
    mock.module("../../src/services/application.service", () => ({
      ApplicationService: {},
    }));
    mock.module("../../src/services/cover-letter.service", () => ({
      CoverLetterService: {
        create: mock(() => {}),
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

describe("POST /cover-letters", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  const getPrisma = () =>
    prismaMock as unknown as {
      coverLetter: { count: Mock };
      template: { findUnique: Mock };
    };

  beforeEach(() => {
    mock.clearAllMocks();
    const prisma = getPrisma();
    prisma.coverLetter.count.mockResolvedValue(0);
    prisma.template.findUnique.mockResolvedValue(null);
  });

  it("creates a cover letter record", async () => {
    const createMock = CoverLetterService.create;
    createMock.mockResolvedValue({
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Cover Letter Baru",
    } as never);

    const response = await request(app)
      .post("/cover-letters")
      .set("Authorization", "Bearer user-token")
      .send({ name: "Cover Letter Baru" });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Cover Letter Baru",
    });
    expect(typeof response.body.data.id).toBe("string");
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app)
      .post("/cover-letters")
      .send({ name: "Cover Letter Baru" });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns validation errors for invalid payloads", async () => {
    const createMock = CoverLetterService.create;
    createMock.mockRejectedValue(
      new ResponseErrorClass(400, "Payload tidak valid")
    );

    const response = await request(app)
      .post("/cover-letters")
      .set("Authorization", "Bearer user-token")
      .send({ name: "" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Payload tidak valid");
  });

  it("blocks creation when the free cover letter limit is reached", async () => {
    const prisma = getPrisma();
    prisma.coverLetter.count.mockResolvedValue(20);

    const response = await request(app)
      .post("/cover-letters")
      .set("Authorization", "Bearer user-token")
      .send(buildCoverLetterPayload("template-basic"));

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe(
      "Batas maksimum surat lamaran telah tercapai"
    );
    expect(response.body.code).toBe("COVER_LETTER_LIMIT_REACHED");
  });

  it("also blocks admins when their plan cover letter limit is reached", async () => {
    const prisma = getPrisma();
    prisma.coverLetter.count.mockResolvedValue(20);

    const response = await request(app)
      .post("/cover-letters")
      .set("Authorization", "Bearer admin-free-token")
      .send(buildCoverLetterPayload("template-basic"));

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe(
      "Batas maksimum surat lamaran telah tercapai"
    );
    expect(response.body.code).toBe("COVER_LETTER_LIMIT_REACHED");
  });

  it("blocks premium cover-letter templates for free users", async () => {
    const prisma = getPrisma();
    prisma.template.findUnique.mockResolvedValue({
      id: "template-premium",
      isPremium: true,
      type: "cover_letter",
    });

    const response = await request(app)
      .post("/cover-letters")
      .set("Authorization", "Bearer user-token")
      .send({
        name: "Cover Letter Premium",
        template_id: "template-premium",
      });

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe(
      "Template ini khusus untuk pengguna Pro atau Max"
    );
    expect(response.body.code).toBe("PREMIUM_TEMPLATE_REQUIRED");
  });

  it("also blocks premium cover-letter templates for admins on free plan", async () => {
    const prisma = getPrisma();
    prisma.template.findUnique.mockResolvedValue({
      id: "template-premium",
      isPremium: true,
      type: "cover_letter",
    });

    const response = await request(app)
      .post("/cover-letters")
      .set("Authorization", "Bearer admin-free-token")
      .send({
        name: "Cover Letter Premium Admin",
        template_id: "template-premium",
      });

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe(
      "Template ini khusus untuk pengguna Pro atau Max"
    );
    expect(response.body.code).toBe("PREMIUM_TEMPLATE_REQUIRED");
  });
});

describe("POST /cover-letters", () => {
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

  it("creates a cover letter record", async () => {
    const { user } = await createRealUser("cover-letter-create");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const template = await createRealTemplateFixture(
      "cover_letter",
      "app-letter-create"
    );
    trackedTemplateIds.add(template.id);

    const response = await request(app)
      .post("/cover-letters")
      .set("Authorization", `Bearer ${token}`)
      .send(
        buildCoverLetterPayload(template.id, {
          email: user.email,
          name: "Budi Santoso",
        })
      );

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      user_id: user.id,
      name: "Budi Santoso",
      template_id: template.id,
      company_name: "PT Karirkit",
      language: "id",
    });
    expect(response.body.data.template).toMatchObject({
      id: template.id,
      type: "cover_letter",
    });
    trackedLetterIds.add(response.body.data.id);
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app).post("/cover-letters").send({
      name: "Cover Letter Baru",
    });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns validation errors for invalid payloads", async () => {
    const { user } = await createRealUser("cover-letter-create-invalid");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const template = await createRealTemplateFixture(
      "cover_letter",
      "app-letter-create-invalid"
    );
    trackedTemplateIds.add(template.id);

    const response = await request(app)
      .post("/cover-letters")
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
