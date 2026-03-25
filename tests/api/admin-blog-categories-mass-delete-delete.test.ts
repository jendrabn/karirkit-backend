import request from "supertest";
import {
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
  loadPrisma,
} from "./real-mode";

let app: typeof import("../../src/index").default;
let BlogCategoryService: typeof import("../../src/services/admin/blog-category.service").BlogCategoryService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/admin/blog-category.service", () => ({
      BlogCategoryService: {
        massDelete: jest.fn(),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ BlogCategoryService } = await import(
    "../../src/services/admin/blog-category.service"
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

describe("DELETE /admin/blog-categories/mass-delete", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deletes multiple blog category records", async () => {
    const massDeleteMock = jest.mocked(BlogCategoryService.massDelete);
    massDeleteMock.mockResolvedValue({
      deleted_count: 2,
      message: "2 kategori blog berhasil dihapus",
    } as never);

    const response = await request(app)
      .delete("/admin/blog-categories/mass-delete")
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
      message: "2 kategori blog berhasil dihapus",
    });
    expect(typeof response.body.data.deleted_count).toBe("number");
  });

  it("returns 403 for non-admin users", async () => {
    const response = await request(app)
      .delete("/admin/blog-categories/mass-delete")
      .set("Authorization", "Bearer user-token")
      .send({ ids: ["550e8400-e29b-41d4-a716-446655440000"] });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns validation errors when no ids are provided", async () => {
    const massDeleteMock = jest.mocked(BlogCategoryService.massDelete);
    massDeleteMock.mockRejectedValue(
      new ResponseErrorClass(400, "Validation error", {
        ids: ["Minimal satu ID harus dipilih"],
      }),
    );

    const response = await request(app)
      .delete("/admin/blog-categories/mass-delete")
      .set("Authorization", "Bearer admin-token")
      .send({ ids: [] });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.ids");
    expect(Array.isArray(response.body.errors.ids)).toBe(true);
  });
});

describe("DELETE /admin/blog-categories/mass-delete", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();
  const trackedBlogIds = new Set<string>();
  const trackedCategoryIds = new Set<string>();

  afterEach(async () => {
    const prisma = await loadPrisma();
    if (trackedBlogIds.size > 0) {
      await prisma.blog.deleteMany({
        where: { id: { in: [...trackedBlogIds] } },
      });
    }
    if (trackedCategoryIds.size > 0) {
      await prisma.blogCategory.deleteMany({
        where: { id: { in: [...trackedCategoryIds] } },
      });
    }
    trackedBlogIds.clear();
    trackedCategoryIds.clear();
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("deletes multiple blog category records", async () => {
    const prisma = await loadPrisma();
    const { user: admin } = await createRealUser("blog-category-mass-delete", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);
    const first = await prisma.blogCategory.create({
      data: {
        name: `Mass Delete 1 ${Date.now()}`,
        slug: `mass-delete-1-${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const second = await prisma.blogCategory.create({
      data: {
        name: `Mass Delete 2 ${Date.now()}`,
        slug: `mass-delete-2-${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const response = await request(app)
      .delete("/admin/blog-categories/mass-delete")
      .set("Authorization", `Bearer ${token}`)
      .send({ ids: [first.id, second.id] });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      deleted_count: 2,
      message: "2 kategori blog berhasil dihapus",
    });

    const remaining = await prisma.blogCategory.findMany({
      where: { id: { in: [first.id, second.id] } },
    });
    expect(remaining).toHaveLength(0);
  });

  it("returns 403 for non-admin users", async () => {
    const { user } = await createRealUser("blog-category-mass-delete-forbidden");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .delete("/admin/blog-categories/mass-delete")
      .set("Authorization", `Bearer ${token}`)
      .send({ ids: ["550e8400-e29b-41d4-a716-446655440000"] });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns validation errors when no ids are provided", async () => {
    const { user: admin } = await createRealUser("blog-category-mass-delete-invalid", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .delete("/admin/blog-categories/mass-delete")
      .set("Authorization", `Bearer ${token}`)
      .send({ ids: [] });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.ids");
    expect(Array.isArray(response.body.errors.ids)).toBe(true);
  });
});
