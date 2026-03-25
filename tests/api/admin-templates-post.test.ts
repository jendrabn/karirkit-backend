import request from "supertest";
import {
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
  loadPrisma,
} from "./real-mode";

let app: typeof import("../../src/index").default;
let TemplateService: typeof import("../../src/services/admin/template.service").TemplateService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/admin/template.service", () => ({
      TemplateService: {
        create: jest.fn(),
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

describe("POST /admin/templates", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a template record", async () => {
    const createMock = jest.mocked(TemplateService.create);
    createMock.mockResolvedValue({
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Template Baru",
    } as never);

    const response = await request(app)
      .post("/admin/templates")
      .set("Authorization", "Bearer admin-token")
      .send({ name: "Template Baru" });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Template Baru",
    });
    expect(typeof response.body.data.id).toBe("string");
  });

  it("returns 403 when a non-admin user calls the endpoint", async () => {
    const response = await request(app)
      .post("/admin/templates")
      .set("Authorization", "Bearer user-token")
      .send({ name: "Template Baru" });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns validation errors for invalid payloads", async () => {
    const createMock = jest.mocked(TemplateService.create);
    createMock.mockRejectedValue(
      new ResponseErrorClass(400, "Validation error", {
        name: ["String must contain at least 1 character(s)"],
      }),
    );

    const response = await request(app)
      .post("/admin/templates")
      .set("Authorization", "Bearer admin-token")
      .send({ name: "" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.name");
    expect(Array.isArray(response.body.errors.name)).toBe(true);
  });
});

describe("POST /admin/templates", () => {
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

  it("creates a template record", async () => {
    const { user: admin } = await createRealUser("admin-template-create", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .post("/admin/templates")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: `Template Baru ${Date.now()}`,
        type: "cv",
        language: "id",
        path: `/uploads/templates/template-${Date.now()}.docx`,
        preview: `/uploads/templates/template-${Date.now()}.png`,
        is_premium: true,
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      type: "cv",
      language: "id",
      is_premium: true,
    });
    expect(response.body.data).toHaveProperty("id");
    trackedTemplateIds.add(response.body.data.id);
  });

  it("returns 403 when a non-admin user calls the endpoint", async () => {
    const { user } = await createRealUser("admin-template-create-forbidden");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .post("/admin/templates")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Template Baru",
        type: "cv",
        path: "/uploads/templates/template.docx",
      });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns validation errors for invalid payloads", async () => {
    const { user: admin } = await createRealUser("admin-template-create-invalid", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .post("/admin/templates")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "", type: "cv", path: "" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.name");
    expect(Array.isArray(response.body.errors.name)).toBe(true);
  });
});
