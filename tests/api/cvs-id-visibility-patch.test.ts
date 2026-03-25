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
        updateSlugVisibility: jest.fn(),
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

describe("PATCH /cvs/:id/visibility", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("updates cv visibility", async () => {
    const updateSlugVisibilityMock = jest.mocked(CvService.updateSlugVisibility);
    updateSlugVisibilityMock.mockResolvedValue({
      id: validId,
      visibility: "public",
      slug: "public-cv",
    } as never);

    const response = await request(app)
      .patch(`/cvs/${validId}/visibility`)
      .set("Authorization", "Bearer user-token")
      .send({
        visibility: "public",
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: validId,
      visibility: "public",
      slug: "public-cv",
    });
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app)
      .patch(`/cvs/${validId}/visibility`)
      .send({
        visibility: "public",
      });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns validation errors for invalid patch payloads", async () => {
    const updateSlugVisibilityMock = jest.mocked(CvService.updateSlugVisibility);
    updateSlugVisibilityMock.mockRejectedValue(
      new ResponseErrorClass(400, "Payload tidak valid")
    );

    const response = await request(app)
      .patch(`/cvs/${validId}/visibility`)
      .set("Authorization", "Bearer user-token")
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Payload tidak valid");
  });
});

describe("PATCH /cvs/:id/visibility", () => {
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

  it("updates cv visibility", async () => {
    const { user } = await createRealUser("cv-visibility");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const template = await createRealTemplateFixture("cv", "cv-visibility");
    trackedTemplateIds.add(template.id);
    const cv = await createRealCvFixture(user.id, template.id, {
      visibility: "private",
      slug: "private-cv",
    });
    trackedCvIds.add(cv.id);

    const response = await request(app)
      .patch(`/cvs/${cv.id}/visibility`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        visibility: "public",
        slug: "public-cv",
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: cv.id,
      visibility: "public",
      slug: "public-cv",
    });
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app)
      .patch(`/cvs/${validId}/visibility`)
      .send({
        visibility: "public",
      });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns validation errors for invalid patch payloads", async () => {
    const { user } = await createRealUser("cv-visibility-invalid");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const template = await createRealTemplateFixture("cv", "cv-visibility-invalid");
    trackedTemplateIds.add(template.id);
    const cv = await createRealCvFixture(user.id, template.id);
    trackedCvIds.add(cv.id);

    const response = await request(app)
      .patch(`/cvs/${cv.id}/visibility`)
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.root");
    expect(Array.isArray(response.body.errors.root)).toBe(true);
  });
});
