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
        get: jest.fn(),
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

describe("GET /admin/templates/:id", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns template details", async () => {
    const getMock = jest.mocked(TemplateService.get);
    getMock.mockResolvedValue({
      id: validId,
      name: "Template Detail",
    } as never);

    const response = await request(app)
      .get(`/admin/templates/${validId}`)
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: validId,
      name: "Template Detail",
    });
    expect(typeof response.body.data.id).toBe("string");
  });

  it("returns 403 when the requester is not an admin", async () => {
    const response = await request(app)
      .get(`/admin/templates/${validId}`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 404 when the template does not exist", async () => {
    const getMock = jest.mocked(TemplateService.get);
    getMock.mockRejectedValue(
      new ResponseErrorClass(404, "Template tidak ditemukan"),
    );

    const response = await request(app)
      .get(`/admin/templates/${validId}`)
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Template tidak ditemukan");
  });
});

describe("GET /admin/templates/:id", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();
  const trackedTemplateIds = new Set<string>();

  afterEach(async () => {
    const prisma = await loadPrisma();
    if (trackedTemplateIds.size > 0) {
      await prisma.template.deleteMany({
        where: {
          id: { in: [...trackedTemplateIds] },
        },
      });
    }
    trackedTemplateIds.clear();
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("returns template details", async () => {
    const prisma = await loadPrisma();
    const { user: admin } = await createRealUser("admin-template-detail", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);
    const suffix = Date.now();

    const template = await prisma.template.create({
      data: {
        name: `Template Detail ${suffix}`,
        type: "application_letter",
        language: "en",
        path: `/uploads/templates/template-detail-${suffix}.docx`,
        preview: `/uploads/templates/template-detail-${suffix}.png`,
        isPremium: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedTemplateIds.add(template.id);

    const response = await request(app)
      .get(`/admin/templates/${template.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: template.id,
      name: template.name,
      type: "application_letter",
      language: "en",
      is_premium: false,
    });
  });

  it("returns 403 when the requester is not an admin", async () => {
    const { user } = await createRealUser("admin-template-detail-forbidden");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .get(`/admin/templates/${validId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 404 when the template does not exist", async () => {
    const { user: admin } = await createRealUser("admin-template-detail-missing", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .get("/admin/templates/missing-template-id")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Template tidak ditemukan");
  });
});
