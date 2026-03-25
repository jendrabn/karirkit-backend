import request from "supertest";
import {
  createRealCvFixture,
  createRealTemplateFixture,
  createRealUser,
  deleteUsersByEmail,
  disconnectPrisma,
  loadPrisma,
} from "./real-mode";

let app: typeof import("../../src/index").default;
let CvService: typeof import("../../src/services/cv.service").CvService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/cv.service", () => ({
      CvService: {
        getPublicBySlug: jest.fn(),
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

describe("GET /cv/:slug", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the public CV payload for a visible slug", async () => {
    const getPublicBySlugMock = jest.mocked(CvService.getPublicBySlug);
    getPublicBySlugMock.mockResolvedValue({
      slug: "public-cv",
      name: "User Resume",
    } as never);

    const response = await request(app).get("/cv/public-cv");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      slug: "public-cv",
      name: "User Resume",
    });
  });

  it("returns 404 when the CV slug does not exist", async () => {
    const getPublicBySlugMock = jest.mocked(CvService.getPublicBySlug);
    getPublicBySlugMock.mockRejectedValue(new ResponseErrorClass(404, "CV publik tidak ditemukan"));

    const response = await request(app).get("/cv/missing-cv");

    expect(response.status).toBe(404);
    expect(response.body.errors.general[0]).toBe("CV publik tidak ditemukan");
  });

  it("returns 404 when the CV is not public anymore", async () => {
    const getPublicBySlugMock = jest.mocked(CvService.getPublicBySlug);
    getPublicBySlugMock.mockRejectedValue(new ResponseErrorClass(404, "CV tidak tersedia"));

    const response = await request(app).get("/cv/hidden-cv");

    expect(response.status).toBe(404);
    expect(response.body.errors.general[0]).toBe("CV tidak tersedia");
  });
});

describe("GET /cv/:slug", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();
  const trackedTemplateIds = new Set<string>();
  const trackedCvIds = new Set<string>();
  const trackedSettingKeys = ["public.cv.enabled"];

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
    await prisma.systemSetting.deleteMany({
      where: { key: { in: trackedSettingKeys } },
    });
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
    trackedTemplateIds.clear();
    trackedCvIds.clear();
  });

  it("returns the public CV payload for a visible slug", async () => {
    const { user } = await createRealUser("cv-public-slug");
    trackedEmails.add(user.email);
    const template = await createRealTemplateFixture("cv", "cv-public-slug");
    trackedTemplateIds.add(template.id);
    const cv = await createRealCvFixture(user.id, template.id, {
      name: "User Resume",
      visibility: "public",
      slug: "public-cv",
    });
    trackedCvIds.add(cv.id);

    const response = await request(app).get("/cv/public-cv");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      slug: "public-cv",
      name: "User Resume",
      visibility: "public",
    });
  });

  it("returns 404 when the CV slug does not exist", async () => {
    const response = await request(app).get("/cv/missing-cv");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("CV tidak ditemukan");
  });

  it("returns 404 when the CV is not public anymore", async () => {
    const { user } = await createRealUser("cv-private-slug");
    trackedEmails.add(user.email);
    const template = await createRealTemplateFixture("cv", "cv-private-slug");
    trackedTemplateIds.add(template.id);
    const cv = await createRealCvFixture(user.id, template.id, {
      visibility: "private",
      slug: "hidden-cv",
    });
    trackedCvIds.add(cv.id);

    const response = await request(app).get("/cv/hidden-cv");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("CV tidak ditemukan");
  });

  it("returns 503 when public CV access is disabled", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("cv-public-disabled");
    trackedEmails.add(user.email);
    const template = await createRealTemplateFixture("cv", "cv-public-disabled");
    trackedTemplateIds.add(template.id);
    const cv = await createRealCvFixture(user.id, template.id, {
      visibility: "public",
      slug: "disabled-public-cv",
    });
    trackedCvIds.add(cv.id);
    await prisma.systemSetting.create({
      data: {
        key: "public.cv.enabled",
        group: "public",
        type: "boolean",
        valueJson: false,
        defaultValueJson: true,
        description: "CV publik",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const response = await request(app).get("/cv/disabled-public-cv");

    expect(response.status).toBe(503);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe(
      "CV publik sedang dinonaktifkan"
    );
  });
});
