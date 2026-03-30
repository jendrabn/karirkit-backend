import request from "supertest";
import {
  buildCvPayload,
  createRealTemplateFixture,
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
  loadPrisma,
} from "./real-mode";

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
        template: { findUnique: jest.fn() },
      },
    }));
    jest.doMock("../../src/services/cv.service", () => ({
      CvService: {
        create: jest.fn(),
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

describe("POST /cvs", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  const getPrisma = () =>
    prismaMock as unknown as {
      cv: { count: jest.Mock };
      template: { findUnique: jest.Mock };
    };

  beforeEach(() => {
    jest.clearAllMocks();
    const prisma = getPrisma();
    prisma.cv.count.mockResolvedValue(0);
    prisma.template.findUnique.mockResolvedValue(null);
  });

  it("creates a cv record", async () => {
    const createMock = jest.mocked(CvService.create);
    createMock.mockResolvedValue({
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "CV Baru",
    } as never);

    const response = await request(app)
      .post("/cvs")
      .set("Authorization", "Bearer user-token")
      .send({ name: "CV Baru" });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "CV Baru",
    });
    expect(typeof response.body.data.id).toBe("string");
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app).post("/cvs").send({ name: "CV Baru" });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns validation errors for invalid payloads", async () => {
    const createMock = jest.mocked(CvService.create);
    createMock.mockRejectedValue(new ResponseErrorClass(400, "Payload tidak valid"));

    const response = await request(app)
      .post("/cvs")
      .set("Authorization", "Bearer user-token")
      .send({ name: "" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Payload tidak valid");
  });

  it("blocks creation when the free CV limit is reached", async () => {
    const prisma = getPrisma();
    prisma.cv.count.mockResolvedValue(5);

    const response = await request(app)
      .post("/cvs")
      .set("Authorization", "Bearer user-token")
      .send(buildCvPayload("template-basic"));

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe(
      "User telah mencapai batas maksimum CV"
    );
    expect(response.body.code).toBe("CV_LIMIT_REACHED");
  });

  it("also blocks admins when their plan CV limit is reached", async () => {
    const prisma = getPrisma();
    prisma.cv.count.mockResolvedValue(5);

    const response = await request(app)
      .post("/cvs")
      .set("Authorization", "Bearer admin-free-token")
      .send(buildCvPayload("template-basic"));

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe(
      "User telah mencapai batas maksimum CV"
    );
    expect(response.body.code).toBe("CV_LIMIT_REACHED");
  });

  it("blocks premium templates for free users", async () => {
    const prisma = getPrisma();
    prisma.template.findUnique.mockResolvedValue({
      id: "template-premium",
      isPremium: true,
    });

    const response = await request(app)
      .post("/cvs")
      .set("Authorization", "Bearer user-token")
      .send({
        name: "CV Premium",
        template_id: "template-premium",
      });

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe(
      "Template ini khusus untuk pengguna Pro atau Max"
    );
    expect(response.body.code).toBe("PREMIUM_TEMPLATE_REQUIRED");
  });

  it("also blocks premium templates for admins on free plan", async () => {
    const prisma = getPrisma();
    prisma.template.findUnique.mockResolvedValue({
      id: "template-premium",
      isPremium: true,
      type: "cv",
    });

    const response = await request(app)
      .post("/cvs")
      .set("Authorization", "Bearer admin-free-token")
      .send({
        name: "CV Premium Admin",
        template_id: "template-premium",
      });

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe(
      "Template ini khusus untuk pengguna Pro atau Max"
    );
    expect(response.body.code).toBe("PREMIUM_TEMPLATE_REQUIRED");
  });
});

describe("POST /cvs", () => {
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

  it("creates a cv record", async () => {
    const { user } = await createRealUser("cv-create");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const template = await createRealTemplateFixture("cv", "cv-create");
    trackedTemplateIds.add(template.id);

    const response = await request(app)
      .post("/cvs")
      .set("Authorization", `Bearer ${token}`)
      .send(buildCvPayload(template.id, { email: user.email, name: "CV Baru" }));

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      user_id: user.id,
      name: "CV Baru",
      template_id: template.id,
      visibility: "private",
      language: "id",
    });
    expect(Array.isArray(response.body.data.educations)).toBe(true);
    expect(Array.isArray(response.body.data.skills)).toBe(true);
    expect(response.body.data.educations[0]?.gpa).toBe(3.8);
    trackedCvIds.add(response.body.data.id);
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app).post("/cvs").send({ name: "CV Baru" });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns validation errors for invalid payloads", async () => {
    const { user } = await createRealUser("cv-create-invalid");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const template = await createRealTemplateFixture("cv", "cv-create-invalid");
    trackedTemplateIds.add(template.id);

    const response = await request(app)
      .post("/cvs")
      .set("Authorization", `Bearer ${token}`)
      .send(buildCvPayload(template.id, { name: "", email: "not-an-email" }));

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.name");
    expect(response.body).toHaveProperty("errors.email");
  });
});
