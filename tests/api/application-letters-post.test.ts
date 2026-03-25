import request from "supertest";
import {
  buildApplicationLetterPayload,
  createRealApplicationLetterFixture,
  createRealTemplateFixture,
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
  loadPrisma,
} from "./real-mode";

let app: typeof import("../../src/index").default;
let ApplicationLetterService: typeof import("../../src/services/application-letter.service").ApplicationLetterService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/application-letter.service", () => ({
      ApplicationLetterService: {
        create: jest.fn(),
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

describe("POST /application-letters", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates an application letter record", async () => {
    const createMock = jest.mocked(ApplicationLetterService.create);
    createMock.mockResolvedValue({
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Application Letter Baru",
    } as never);

    const response = await request(app)
      .post("/application-letters")
      .set("Authorization", "Bearer user-token")
      .send({ name: "Application Letter Baru" });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Application Letter Baru",
    });
    expect(typeof response.body.data.id).toBe("string");
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app)
      .post("/application-letters")
      .send({ name: "Application Letter Baru" });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns validation errors for invalid payloads", async () => {
    const createMock = jest.mocked(ApplicationLetterService.create);
    createMock.mockRejectedValue(
      new ResponseErrorClass(400, "Payload tidak valid")
    );

    const response = await request(app)
      .post("/application-letters")
      .set("Authorization", "Bearer user-token")
      .send({ name: "" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Payload tidak valid");
  });
});

describe("POST /application-letters", () => {
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

  it("creates an application letter record", async () => {
    const { user } = await createRealUser("application-letter-create");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const template = await createRealTemplateFixture(
      "application_letter",
      "app-letter-create"
    );
    trackedTemplateIds.add(template.id);

    const response = await request(app)
      .post("/application-letters")
      .set("Authorization", `Bearer ${token}`)
      .send(
        buildApplicationLetterPayload(template.id, {
          email: user.email,
          name: "Budi Santoso",
        })
      );

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      user_id: user.id,
      name: "Budi Santoso",
      template_id: template.id,
      company_name: "PT Karirkit",
      language: "id",
    });
    expect(response.body.data.template).toMatchObject({
      id: template.id,
      type: "application_letter",
    });
    trackedLetterIds.add(response.body.data.id);
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app).post("/application-letters").send({
      name: "Application Letter Baru",
    });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns validation errors for invalid payloads", async () => {
    const { user } = await createRealUser("application-letter-create-invalid");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const template = await createRealTemplateFixture(
      "application_letter",
      "app-letter-create-invalid"
    );
    trackedTemplateIds.add(template.id);

    const response = await request(app)
      .post("/application-letters")
      .set("Authorization", `Bearer ${token}`)
      .send(
        buildApplicationLetterPayload(template.id, {
          name: "",
          email: "invalid-email",
        })
      );

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.name");
    expect(response.body).toHaveProperty("errors.email");
  });
});
