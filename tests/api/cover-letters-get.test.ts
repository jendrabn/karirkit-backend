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

beforeAll(async () => {
if (process.env.RUN_REAL_API_TESTS !== "true") {
    mock.module("../../src/services/cover-letter.service", () => ({
      CoverLetterService: {
        list: mock(() => {}),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ CoverLetterService } = await import(
    "../../src/services/cover-letter.service"
  ));
});

afterAll(async () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    await disconnectPrisma();
  }
});

describe("GET /cover-letters", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    mock.clearAllMocks();
  });

  it("returns a paginated cover letter list", async () => {
    const listMock = CoverLetterService.list;
    listMock.mockResolvedValue({
      items: [{ id: validId, name: "Cover Letter 1" }],
      meta: { page: 1, per_page: 20, total: 1 },
    } as never);

    const response = await request(app)
      .get("/cover-letters")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body).toHaveProperty("data.meta");
    expect(Array.isArray(response.body.data.items)).toBe(true);
    expect(response.body.data.items[0]).toMatchObject({
      id: validId,
      name: "Cover Letter 1",
    });
    expect(typeof response.body.data.meta.total).toBe("number");
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).get("/cover-letters");

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("supports an empty cover letter state", async () => {
    const listMock = CoverLetterService.list;
    listMock.mockResolvedValue({
      items: [],
      meta: { page: 1, per_page: 20, total: 0 },
    } as never);

    const response = await request(app)
      .get("/cover-letters")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body.data.items).toEqual([]);
    expect(response.body.data.meta.total).toBe(0);
  });
});

describe("GET /cover-letters", () => {
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

  it("returns a paginated cover letter list", async () => {
    const { user } = await createRealUser("cover-letter-list");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const template = await createRealTemplateFixture(
      "cover_letter",
      "app-letter-list"
    );
    trackedTemplateIds.add(template.id);
    const letterOne = await createRealCoverLetterFixture(user.id, template.id, {
      name: "Cover Letter Alpha",
      subject: "Alpha",
    });
    const letterTwo = await createRealCoverLetterFixture(user.id, template.id, {
      name: "Cover Letter Beta",
      subject: "Beta",
    });
    trackedLetterIds.add(letterOne.id);
    trackedLetterIds.add(letterTwo.id);

    const response = await request(app)
      .get("/cover-letters?q=Cover Letter&sort_by=name&sort_order=asc")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body).toHaveProperty("data.pagination");
    expect(Array.isArray(response.body.data.items)).toBe(true);
    expect(response.body.data.items).toHaveLength(2);
    expect(response.body.data.pagination.total_items).toBe(2);
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).get("/cover-letters");

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("supports an empty cover letter state", async () => {
    const { user } = await createRealUser("cover-letter-list-empty");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .get("/cover-letters")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.items).toEqual([]);
    expect(response.body.data.pagination.total_items).toBe(0);
  });
});
