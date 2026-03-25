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
        massDelete: jest.fn(),
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

describe("DELETE /admin/templates/mass-delete", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deletes multiple template records", async () => {
    const massDeleteMock = jest.mocked(TemplateService.massDelete);
    massDeleteMock.mockResolvedValue({
      deleted_count: 2,
      message: "2 template berhasil dihapus",
    } as never);

    const response = await request(app)
      .delete("/admin/templates/mass-delete")
      .set("Authorization", "Bearer admin-token")
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
      message: "2 template berhasil dihapus",
    });
    expect(typeof response.body.data.deleted_count).toBe("number");
  });

  it("returns 403 for non-admin users", async () => {
    const response = await request(app)
      .delete("/admin/templates/mass-delete")
      .set("Authorization", "Bearer user-token")
      .send({ ids: ["550e8400-e29b-41d4-a716-446655440000"] });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns validation errors when no ids are provided", async () => {
    const massDeleteMock = jest.mocked(TemplateService.massDelete);
    massDeleteMock.mockRejectedValue(
      new ResponseErrorClass(400, "Validation error", {
        ids: ["Minimal satu ID harus dipilih"],
      }),
    );

    const response = await request(app)
      .delete("/admin/templates/mass-delete")
      .set("Authorization", "Bearer admin-token")
      .send({ ids: [] });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.ids");
    expect(Array.isArray(response.body.errors.ids)).toBe(true);
  });
});

describe("DELETE /admin/templates/mass-delete", () => {
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

  it("deletes multiple template records", async () => {
    const prisma = await loadPrisma();
    const { user: admin } = await createRealUser("admin-template-mass-delete", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);
    const first = await prisma.template.create({
      data: {
        name: `Mass Template 1 ${Date.now()}`,
        type: "cv",
        path: `/uploads/templates/mass-template-1-${Date.now()}.docx`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const second = await prisma.template.create({
      data: {
        name: `Mass Template 2 ${Date.now()}`,
        type: "application_letter",
        path: `/uploads/templates/mass-template-2-${Date.now()}.docx`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const response = await request(app)
      .delete("/admin/templates/mass-delete")
      .set("Authorization", `Bearer ${token}`)
      .send({ ids: [first.id, second.id] });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      deleted_count: 2,
      message: "2 template berhasil dihapus",
    });

    const remaining = await prisma.template.findMany({
      where: { id: { in: [first.id, second.id] } },
    });
    expect(remaining).toHaveLength(0);
  });

  it("returns 403 for non-admin users", async () => {
    const { user } = await createRealUser("admin-template-mass-delete-forbidden");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .delete("/admin/templates/mass-delete")
      .set("Authorization", `Bearer ${token}`)
      .send({ ids: ["550e8400-e29b-41d4-a716-446655440000"] });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns validation errors when no ids are provided", async () => {
    const { user: admin } = await createRealUser("admin-template-mass-delete-invalid", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .delete("/admin/templates/mass-delete")
      .set("Authorization", `Bearer ${token}`)
      .send({ ids: [] });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.ids");
    expect(Array.isArray(response.body.errors.ids)).toBe(true);
  });
});
