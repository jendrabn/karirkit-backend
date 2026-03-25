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

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/admin/template.service", () => ({
      TemplateService: {
        list: jest.fn(),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ TemplateService } = await import(
    "../../src/services/admin/template.service"
  ));
});

afterAll(async () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    await disconnectPrisma();
  }
});

describe("GET /admin/templates", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a paginated template list", async () => {
    const listMock = jest.mocked(TemplateService.list);
    listMock.mockResolvedValue({
      items: [{ id: validId, name: "Template 1" }],
      pagination: { page: 1, per_page: 20, total_items: 1, total_pages: 1 },
    } as never);

    const response = await request(app)
      .get("/admin/templates")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body).toHaveProperty("data.pagination");
    expect(Array.isArray(response.body.data.items)).toBe(true);
    expect(response.body.data.items[0]).toMatchObject({
      id: validId,
      name: "Template 1",
    });
    expect(typeof response.body.data.pagination.total_items).toBe("number");
  });

  it("returns 403 when a non-admin user accesses the endpoint", async () => {
    const response = await request(app)
      .get("/admin/templates")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("supports an empty template state", async () => {
    const listMock = jest.mocked(TemplateService.list);
    listMock.mockResolvedValue({
      items: [],
      pagination: { page: 1, per_page: 20, total_items: 0, total_pages: 0 },
    } as never);

    const response = await request(app)
      .get("/admin/templates")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body.data.items).toEqual([]);
    expect(response.body.data.pagination.total_items).toBe(0);
  });
});

describe("GET /admin/templates", () => {
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

  it("returns a paginated template list", async () => {
    const prisma = await loadPrisma();
    const { user: admin } = await createRealUser("admin-templates-list", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);
    const suffix = Date.now();

    const template = await prisma.template.create({
      data: {
        name: `Real Template ${suffix}`,
        type: "cv",
        language: "id",
        path: `/uploads/templates/template-${suffix}.docx`,
        preview: `/uploads/templates/template-${suffix}.png`,
        isPremium: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedTemplateIds.add(template.id);

    const response = await request(app)
      .get(`/admin/templates?q=${encodeURIComponent(template.name)}&type=cv`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body).toHaveProperty("data.pagination");
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0]).toMatchObject({
      id: template.id,
      name: template.name,
      type: "cv",
      language: "id",
      is_premium: true,
    });
    expect(response.body.data.pagination.total_items).toBe(1);
  });

  it("returns 403 when a non-admin user accesses the endpoint", async () => {
    const { user } = await createRealUser("admin-templates-forbidden");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .get("/admin/templates")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the template date range is invalid", async () => {
    const { user: admin } = await createRealUser("admin-templates-invalid", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .get("/admin/templates?created_at_from=2026-03-10&created_at_to=2026-03-01")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.created_at_from");
    expect(Array.isArray(response.body.errors.created_at_from)).toBe(true);
  });
});
