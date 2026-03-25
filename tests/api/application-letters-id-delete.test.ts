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
        delete: jest.fn(),
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

describe("DELETE /application-letters/:id", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deletes the application letter resource", async () => {
    const deleteMock = jest.mocked(ApplicationLetterService.delete);
    deleteMock.mockResolvedValue(undefined as never);

    const response = await request(app)
      .delete(`/application-letters/${validId}`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app).delete(`/application-letters/${validId}`);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 404 when the application letter cannot be found", async () => {
    const deleteMock = jest.mocked(ApplicationLetterService.delete);
    deleteMock.mockRejectedValue(
      new ResponseErrorClass(404, "Surat lamaran tidak ditemukan")
    );

    const response = await request(app)
      .delete(`/application-letters/${validId}`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Surat lamaran tidak ditemukan");
  });
});

describe("DELETE /application-letters/:id", () => {
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

  it("deletes the application letter resource", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("application-letter-delete");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const template = await createRealTemplateFixture(
      "application_letter",
      "app-letter-delete"
    );
    trackedTemplateIds.add(template.id);
    const letter = await createRealApplicationLetterFixture(user.id, template.id);

    const response = await request(app)
      .delete(`/application-letters/${letter.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(204);

    const deleted = await prisma.applicationLetter.findUnique({
      where: { id: letter.id },
    });
    expect(deleted).toBeNull();
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app).delete(`/application-letters/${validId}`);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 404 when the application letter cannot be found", async () => {
    const { user } = await createRealUser("application-letter-delete-missing");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .delete("/application-letters/550e8400-e29b-41d4-a716-446655440099")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Surat lamaran tidak ditemukan");
  });
});
