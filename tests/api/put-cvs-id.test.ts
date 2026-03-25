import request from "supertest";
import {
  buildCvPayload,
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
        update: jest.fn(),
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

describe("PUT /cvs/:id", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("updates a cv record", async () => {
    const updateMock = jest.mocked(CvService.update);
    updateMock.mockResolvedValue({ id: validId, name: "CV Diperbarui" } as never);

    const response = await request(app)
      .put(`/cvs/${validId}`)
      .set("Authorization", "Bearer user-token")
      .send({ name: "CV Diperbarui" });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({ id: validId, name: "CV Diperbarui" });
    expect(typeof response.body.data.name).toBe("string");
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app)
      .put(`/cvs/${validId}`)
      .send({ name: "CV Diperbarui" });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns validation errors for invalid updates", async () => {
    const updateMock = jest.mocked(CvService.update);
    updateMock.mockRejectedValue(new ResponseErrorClass(400, "Payload tidak valid"));

    const response = await request(app)
      .put(`/cvs/${validId}`)
      .set("Authorization", "Bearer user-token")
      .send({ name: "" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Payload tidak valid");
  });
});

describe("PUT /cvs/:id", () => {
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

  it("updates a cv record", async () => {
    const { user } = await createRealUser("cv-update");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const template = await createRealTemplateFixture("cv", "cv-update");
    trackedTemplateIds.add(template.id);
    const cv = await createRealCvFixture(user.id, template.id);
    trackedCvIds.add(cv.id);

    const response = await request(app)
      .put(`/cvs/${cv.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send(
        buildCvPayload(template.id, {
          name: "CV Diperbarui",
          headline: "Senior Backend Engineer",
          email: user.email,
        })
      );

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: cv.id,
      name: "CV Diperbarui",
      headline: "Senior Backend Engineer",
      template_id: template.id,
    });
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app)
      .put(`/cvs/${validId}`)
      .send({ name: "CV Diperbarui" });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns validation errors for invalid updates", async () => {
    const { user } = await createRealUser("cv-update-invalid");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const template = await createRealTemplateFixture("cv", "cv-update-invalid");
    trackedTemplateIds.add(template.id);
    const cv = await createRealCvFixture(user.id, template.id);
    trackedCvIds.add(cv.id);

    const response = await request(app)
      .put(`/cvs/${cv.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send(buildCvPayload(template.id, { name: "", email: "invalid-email" }));

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.name");
    expect(response.body).toHaveProperty("errors.email");
  });
});
