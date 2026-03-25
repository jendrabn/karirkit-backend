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

const validId = "550e8400-e29b-41d4-a716-446655440000";

let app: typeof import("../../src/index").default;
let ApplicationLetterService: typeof import("../../src/services/application-letter.service").ApplicationLetterService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/application-letter.service", () => ({
      ApplicationLetterService: {
        update: jest.fn(),
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

describe("PUT /application-letters/:id", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("updates an application letter record", async () => {
    const updateMock = jest.mocked(ApplicationLetterService.update);
    updateMock.mockResolvedValue({
      id: validId,
      name: "Application Letter Diperbarui",
    } as never);

    const response = await request(app)
      .put(`/application-letters/${validId}`)
      .set("Authorization", "Bearer user-token")
      .send({ name: "Application Letter Diperbarui" });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: validId,
      name: "Application Letter Diperbarui",
    });
    expect(typeof response.body.data.name).toBe("string");
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app)
      .put(`/application-letters/${validId}`)
      .send({ name: "Application Letter Diperbarui" });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns validation errors for invalid updates", async () => {
    const updateMock = jest.mocked(ApplicationLetterService.update);
    updateMock.mockRejectedValue(
      new ResponseErrorClass(400, "Payload tidak valid")
    );

    const response = await request(app)
      .put(`/application-letters/${validId}`)
      .set("Authorization", "Bearer user-token")
      .send({ name: "" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Payload tidak valid");
  });
});

describe("PUT /application-letters/:id", () => {
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

  it("updates an application letter record", async () => {
    const { user } = await createRealUser("application-letter-update");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const template = await createRealTemplateFixture(
      "application_letter",
      "app-letter-update"
    );
    trackedTemplateIds.add(template.id);
    const letter = await createRealApplicationLetterFixture(user.id, template.id);
    trackedLetterIds.add(letter.id);

    const response = await request(app)
      .put(`/application-letters/${letter.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send(
        buildApplicationLetterPayload(template.id, {
          name: "Application Letter Diperbarui",
          company_name: "PT Karirkit Updated",
          email: user.email,
        })
      );

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: letter.id,
      name: "Application Letter Diperbarui",
      company_name: "PT Karirkit Updated",
      template_id: template.id,
    });
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app)
      .put(`/application-letters/${validId}`)
      .send({ name: "Application Letter Diperbarui" });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns validation errors for invalid updates", async () => {
    const { user } = await createRealUser("application-letter-update-invalid");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const template = await createRealTemplateFixture(
      "application_letter",
      "app-letter-update-invalid"
    );
    trackedTemplateIds.add(template.id);
    const letter = await createRealApplicationLetterFixture(user.id, template.id);
    trackedLetterIds.add(letter.id);

    const response = await request(app)
      .put(`/application-letters/${letter.id}`)
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
