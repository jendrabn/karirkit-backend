import request from "supertest";
import {
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
  loadPrisma,
} from "./real-mode";

const validId = "550e8400-e29b-41d4-a716-446655440000";
let app: typeof import("../../src/index").default;
let TemplateService: typeof import("../../src/services/admin/template.service").TemplateService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/admin/template.service", () => ({
      TemplateService: {
        update: jest.fn(),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ TemplateService } = await import(
    "../../src/services/admin/template.service"
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

describe("PUT /admin/templates/:id", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("updates a template record", async () => {
    const updateMock = jest.mocked(TemplateService.update);
    updateMock.mockResolvedValue({
      id: validId,
      name: "Template Diperbarui",
    } as never);

    const response = await request(app)
      .put(`/admin/templates/${validId}`)
      .set("Authorization", "Bearer admin-token")
      .send({ name: "Template Diperbarui" });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: validId,
      name: "Template Diperbarui",
    });
    expect(typeof response.body.data.name).toBe("string");
  });

  it("returns 403 when a non-admin user updates the resource", async () => {
    const response = await request(app)
      .put(`/admin/templates/${validId}`)
      .set("Authorization", "Bearer user-token")
      .send({ name: "Template Diperbarui" });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns validation errors for invalid updates", async () => {
    const updateMock = jest.mocked(TemplateService.update);
    updateMock.mockRejectedValue(
      new ResponseErrorClass(400, "Validation error", {
        name: ["String must contain at least 1 character(s)"],
      }),
    );

    const response = await request(app)
      .put(`/admin/templates/${validId}`)
      .set("Authorization", "Bearer admin-token")
      .send({ name: "" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.name");
    expect(Array.isArray(response.body.errors.name)).toBe(true);
  });
});

describe("PUT /admin/templates/:id", () => {
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
    trackedTemplateIds.clear();
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("updates a template record", async () => {
    const prisma = await loadPrisma();
    const { user: admin } = await createRealUser("admin-template-update", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);
    const template = await prisma.template.create({
      data: {
        name: `Template Update ${Date.now()}`,
        type: "cv",
        language: "en",
        path: `/uploads/templates/template-update-${Date.now()}.docx`,
        preview: `/uploads/templates/template-update-${Date.now()}.png`,
        isPremium: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedTemplateIds.add(template.id);

    const response = await request(app)
      .put(`/admin/templates/${template.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Template Diperbarui",
        type: "application_letter",
        language: "id",
        is_premium: true,
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: template.id,
      name: "Template Diperbarui",
      type: "application_letter",
      language: "id",
      is_premium: true,
    });
  });

  it("returns 403 when a non-admin user updates the resource", async () => {
    const { user } = await createRealUser("admin-template-update-forbidden");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .put(`/admin/templates/${validId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Template Diperbarui" });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns validation errors for invalid updates", async () => {
    const prisma = await loadPrisma();
    const { user: admin } = await createRealUser("admin-template-update-invalid", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);
    const template = await prisma.template.create({
      data: {
        name: `Template Invalid ${Date.now()}`,
        type: "cv",
        path: `/uploads/templates/template-invalid-${Date.now()}.docx`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedTemplateIds.add(template.id);

    const response = await request(app)
      .put(`/admin/templates/${template.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.name");
    expect(Array.isArray(response.body.errors.name)).toBe(true);
  });
});
