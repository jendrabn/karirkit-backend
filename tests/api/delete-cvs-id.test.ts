import request from "supertest";
import {
  createRealCvFixture,
  createRealTemplateFixture,
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
  loadPrisma,
} from "./real-mode";

const validId = "550e8400-e29b-41d4-a716-446655440000";

let app: typeof import("../../src/index").default;
let CvService: typeof import("../../src/services/cv.service").CvService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/cv.service", () => ({
      CvService: {
        delete: jest.fn(),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ CvService } = await import("../../src/services/cv.service"));
  ({ ResponseError: ResponseErrorClass } = await import(
    "../../src/utils/response-error.util"
  ));
});

afterAll(async () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    await disconnectPrisma();
  }
});

describe("DELETE /cvs/:id", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deletes the cv resource", async () => {
    const deleteMock = jest.mocked(CvService.delete);
    deleteMock.mockResolvedValue(undefined as never);

    const response = await request(app)
      .delete(`/cvs/${validId}`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app).delete(`/cvs/${validId}`);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 404 when the cv cannot be found", async () => {
    const deleteMock = jest.mocked(CvService.delete);
    deleteMock.mockRejectedValue(new ResponseErrorClass(404, "CV tidak ditemukan"));

    const response = await request(app)
      .delete(`/cvs/${validId}`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("CV tidak ditemukan");
  });
});

describe("DELETE /cvs/:id", () => {
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

  it("deletes the cv resource", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("cv-delete");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const template = await createRealTemplateFixture("cv", "cv-delete");
    trackedTemplateIds.add(template.id);
    const cv = await createRealCvFixture(user.id, template.id);

    const response = await request(app)
      .delete(`/cvs/${cv.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(204);

    const deleted = await prisma.cv.findUnique({ where: { id: cv.id } });
    expect(deleted).toBeNull();
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app).delete(`/cvs/${validId}`);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 404 when the cv cannot be found", async () => {
    const { user } = await createRealUser("cv-delete-missing");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .delete("/cvs/550e8400-e29b-41d4-a716-446655440099")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("CV tidak ditemukan");
  });
});
