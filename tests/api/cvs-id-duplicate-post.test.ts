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
let prismaMock: typeof import("../../src/config/prisma.config").prisma;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/config/prisma.config", () => ({
      prisma: {
        cv: { count: jest.fn() },
      },
    }));
    jest.doMock("../../src/services/cv.service", () => ({
      CvService: {
        duplicate: jest.fn(),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ CvService } = await import("../../src/services/cv.service"));
  ({ prisma: prismaMock } = await import("../../src/config/prisma.config"));
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
  const getPrisma = () =>
    prismaMock as unknown as {
      cv: { count: jest.Mock };
    };

  beforeEach(() => {
    jest.clearAllMocks();
    getPrisma().cv.count.mockResolvedValue(0);
  });

  it("duplicates the cv record", async () => {
    const duplicateMock = jest.mocked(CvService.duplicate);
    duplicateMock.mockResolvedValue({
      id: "660e8400-e29b-41d4-a716-446655440000",
      name: "CV Salinan",
    } as never);

    const response = await request(app)
      .post(`/cvs/${validId}/duplicate`)
      .set("Authorization", "Bearer pro-token");

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
      .set("Authorization", "Bearer pro-token");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("CV tidak ditemukan");
  });

  it("allows duplication for free users", async () => {
    const duplicateMock = jest.mocked(CvService.duplicate);
    duplicateMock.mockResolvedValue({
      id: "660e8400-e29b-41d4-a716-446655440000",
      name: "CV Salinan",
    } as never);

    const response = await request(app)
      .post(`/cvs/${validId}/duplicate`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      id: "660e8400-e29b-41d4-a716-446655440000",
      name: "CV Salinan",
    });
  });

  it("blocks duplication for admins when their plan CV limit is reached", async () => {
    const prisma = getPrisma();
    prisma.cv.count.mockResolvedValue(5);

    const response = await request(app)
      .post(`/cvs/${validId}/duplicate`)
      .set("Authorization", "Bearer admin-free-token");

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe(
      "User telah mencapai batas maksimum CV"
    );
    expect(response.body.code).toBe("CV_LIMIT_REACHED");
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
    const { user } = await createRealUser("cv-duplicate", {
      planId: "pro",
    });
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
    const { user } = await createRealUser("cv-duplicate-missing", {
      planId: "pro",
    });
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
