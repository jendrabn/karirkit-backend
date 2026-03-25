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

let app: typeof import("../../src/index").default;
let CvService: typeof import("../../src/services/cv.service").CvService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/cv.service", () => ({
      CvService: {
        massDelete: jest.fn(),
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

describe("DELETE /cvs/mass-delete", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deletes multiple cv records", async () => {
    const massDeleteMock = jest.mocked(CvService.massDelete);
    massDeleteMock.mockResolvedValue({
      deleted_count: 2,
      ids: [
        "550e8400-e29b-41d4-a716-446655440000",
        "660e8400-e29b-41d4-a716-446655440000",
      ],
    } as never);

    const response = await request(app)
      .delete("/cvs/mass-delete")
      .set("Authorization", "Bearer user-token")
      .send({
        ids: [
          "550e8400-e29b-41d4-a716-446655440000",
          "660e8400-e29b-41d4-a716-446655440000",
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      deleted_count: 2,
      ids: [
        "550e8400-e29b-41d4-a716-446655440000",
        "660e8400-e29b-41d4-a716-446655440000",
      ],
    });
    expect(typeof response.body.data.deleted_count).toBe("number");
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app)
      .delete("/cvs/mass-delete")
      .send({ ids: ["550e8400-e29b-41d4-a716-446655440000"] });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns validation errors when no ids are provided", async () => {
    const massDeleteMock = jest.mocked(CvService.massDelete);
    massDeleteMock.mockRejectedValue(
      new ResponseErrorClass(400, "Minimal satu data harus dipilih")
    );

    const response = await request(app)
      .delete("/cvs/mass-delete")
      .set("Authorization", "Bearer user-token")
      .send({ ids: [] });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Minimal satu data harus dipilih");
  });
});

describe("DELETE /cvs/mass-delete", () => {
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

  it("deletes multiple cv records", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("cv-mass-delete");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const template = await createRealTemplateFixture("cv", "cv-mass-delete");
    trackedTemplateIds.add(template.id);
    const cvOne = await createRealCvFixture(user.id, template.id);
    const cvTwo = await createRealCvFixture(user.id, template.id);

    const response = await request(app)
      .delete("/cvs/mass-delete")
      .set("Authorization", `Bearer ${token}`)
      .send({ ids: [cvOne.id, cvTwo.id] });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data.deleted_count).toBe(2);

    const remaining = await prisma.cv.findMany({
      where: { id: { in: [cvOne.id, cvTwo.id] } },
    });
    expect(remaining).toHaveLength(0);
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app)
      .delete("/cvs/mass-delete")
      .send({ ids: ["550e8400-e29b-41d4-a716-446655440000"] });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns errors when one of the CVs is missing", async () => {
    const { user } = await createRealUser("cv-mass-delete-missing");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const template = await createRealTemplateFixture("cv", "cv-mass-delete-missing");
    trackedTemplateIds.add(template.id);
    const cv = await createRealCvFixture(user.id, template.id);
    trackedCvIds.add(cv.id);

    const response = await request(app)
      .delete("/cvs/mass-delete")
      .set("Authorization", `Bearer ${token}`)
      .send({ ids: [cv.id, "550e8400-e29b-41d4-a716-446655440099"] });

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Satu atau lebih CV tidak ditemukan");
  });
});
