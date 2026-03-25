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
        duplicate: jest.fn(),
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

describe("POST /cvs/:id/duplicate", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("duplicates the cv record", async () => {
    const duplicateMock = jest.mocked(CvService.duplicate);
    duplicateMock.mockResolvedValue({
      id: "660e8400-e29b-41d4-a716-446655440000",
      name: "CV Salinan",
    } as never);

    const response = await request(app)
      .post(`/cvs/${validId}/duplicate`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: "660e8400-e29b-41d4-a716-446655440000",
      name: "CV Salinan",
    });
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).post(`/cvs/${validId}/duplicate`);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 404 when the cv cannot be duplicated", async () => {
    const duplicateMock = jest.mocked(CvService.duplicate);
    duplicateMock.mockRejectedValue(new ResponseErrorClass(404, "CV tidak ditemukan"));

    const response = await request(app)
      .post(`/cvs/${validId}/duplicate`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("CV tidak ditemukan");
  });
});

describe("POST /cvs/:id/duplicate", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();
  const trackedTemplateIds = new Set<string>();
  const trackedCvIds = new Set<string>();

  afterEach(async () => {
    const prisma = await loadPrisma();
    if (trackedCvIds.size > 0) {
      await prisma.cv.deleteMany({
        where: { id: { in: [...trackedCvIds] } },
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
    trackedCvIds.clear();
  });

  it("duplicates the cv record", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("cv-duplicate");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const template = await createRealTemplateFixture("cv", "cv-duplicate");
    trackedTemplateIds.add(template.id);
    const source = await createRealCvFixture(user.id, template.id, { name: "CV Source" });
    trackedCvIds.add(source.id);

    const response = await request(app)
      .post(`/cvs/${source.id}/duplicate`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      user_id: user.id,
      name: "CV Source",
      template_id: template.id,
    });
    expect(response.body.data.id).not.toBe(source.id);
    trackedCvIds.add(response.body.data.id);

    const total = await prisma.cv.count({ where: { userId: user.id } });
    expect(total).toBe(2);
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).post(`/cvs/${validId}/duplicate`);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 404 when the cv cannot be duplicated", async () => {
    const { user } = await createRealUser("cv-duplicate-missing");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .post("/cvs/550e8400-e29b-41d4-a716-446655440099/duplicate")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("CV tidak ditemukan");
  });
});
