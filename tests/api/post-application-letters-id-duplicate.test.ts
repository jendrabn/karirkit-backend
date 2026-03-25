import request from "supertest";
import {
  createRealApplicationLetterFixture,
  createRealTemplateFixture,
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
  loadPrisma,
} from "./real-mode";

const validId = "550e8400-e29b-41d4-a716-446655440000";

let app: typeof import("../../src/index").default;
let ApplicationLetterService: typeof import("../../src/services/application-letter.service").ApplicationLetterService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/application-letter.service", () => ({
      ApplicationLetterService: {
        duplicate: jest.fn(),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ ApplicationLetterService } = await import(
    "../../src/services/application-letter.service"
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

describe("POST /application-letters/:id/duplicate", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("duplicates the application letter record", async () => {
    const duplicateMock = jest.mocked(ApplicationLetterService.duplicate);
    duplicateMock.mockResolvedValue({
      id: "660e8400-e29b-41d4-a716-446655440000",
      name: "Application Letter Salinan",
    } as never);

    const response = await request(app)
      .post(`/application-letters/${validId}/duplicate`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: "660e8400-e29b-41d4-a716-446655440000",
      name: "Application Letter Salinan",
    });
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).post(
      `/application-letters/${validId}/duplicate`
    );

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 404 when the application letter cannot be duplicated", async () => {
    const duplicateMock = jest.mocked(ApplicationLetterService.duplicate);
    duplicateMock.mockRejectedValue(
      new ResponseErrorClass(404, "Surat lamaran tidak ditemukan")
    );

    const response = await request(app)
      .post(`/application-letters/${validId}/duplicate`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Surat lamaran tidak ditemukan");
  });
});

describe("POST /application-letters/:id/duplicate", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();
  const trackedTemplateIds = new Set<string>();
  const trackedLetterIds = new Set<string>();

  afterEach(async () => {
    const prisma = await loadPrisma();
    if (trackedLetterIds.size > 0) {
      await prisma.applicationLetter.deleteMany({
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

  it("duplicates the application letter record", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("application-letter-duplicate");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const template = await createRealTemplateFixture(
      "application_letter",
      "app-letter-duplicate"
    );
    trackedTemplateIds.add(template.id);
    const source = await createRealApplicationLetterFixture(user.id, template.id, {
      name: "Application Letter Source",
    });
    trackedLetterIds.add(source.id);

    const response = await request(app)
      .post(`/application-letters/${source.id}/duplicate`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      name: "Application Letter Source",
      user_id: user.id,
      template_id: template.id,
    });
    expect(response.body.data.id).not.toBe(source.id);
    trackedLetterIds.add(response.body.data.id);

    const total = await prisma.applicationLetter.count({
      where: { userId: user.id },
    });
    expect(total).toBe(2);
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).post(
      `/application-letters/${validId}/duplicate`
    );

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 404 when the application letter cannot be duplicated", async () => {
    const { user } = await createRealUser("application-letter-duplicate-missing");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .post("/application-letters/550e8400-e29b-41d4-a716-446655440099/duplicate")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Surat lamaran tidak ditemukan");
  });
});
