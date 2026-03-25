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
let BlogTagService: typeof import("../../src/services/admin/blog-tag.service").BlogTagService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/admin/blog-tag.service", () => ({
      BlogTagService: {
        delete: jest.fn(),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ BlogTagService } = await import("../../src/services/admin/blog-tag.service"));
  ({ ResponseError: ResponseErrorClass } = await import(
    "../../src/utils/response-error.util"
  ));
});

afterAll(async () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    await disconnectPrisma();
  }
});

describe("DELETE /admin/blog-tags/:id", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deletes the blog tag resource", async () => {
    const deleteMock = jest.mocked(BlogTagService.delete);
    deleteMock.mockResolvedValue(undefined as never);

    const response = await request(app)
      .delete(`/admin/blog-tags/${validId}`)
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
  });

  it("returns 403 for non-admin users", async () => {
    const response = await request(app)
      .delete(`/admin/blog-tags/${validId}`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 404 when the blog tag cannot be found", async () => {
    const deleteMock = jest.mocked(BlogTagService.delete);
    deleteMock.mockRejectedValue(
      new ResponseErrorClass(404, "Tag blog tidak ditemukan"),
    );

    const response = await request(app)
      .delete(`/admin/blog-tags/${validId}`)
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Tag blog tidak ditemukan");
  });
});

describe("DELETE /admin/blog-tags/:id", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();
  const trackedBlogIds = new Set<string>();
  const trackedCategoryIds = new Set<string>();
  const trackedTagIds = new Set<string>();

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
    if (trackedTagIds.size > 0) {
      await prisma.blogTag.deleteMany({
        where: { id: { in: [...trackedTagIds] } },
      });
    }
    trackedBlogIds.clear();
    trackedCategoryIds.clear();
    trackedTagIds.clear();
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("deletes the blog tag resource", async () => {
    const prisma = await loadPrisma();
    const { user: admin } = await createRealUser("blog-tag-delete", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);
    const tag = await prisma.blogTag.create({
      data: {
        name: `Tag Delete ${Date.now()}`,
        slug: `tag-delete-${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const response = await request(app)
      .delete(`/admin/blog-tags/${tag.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(204);

    const found = await prisma.blogTag.findUnique({
      where: { id: tag.id },
    });
    expect(found).toBeNull();
  });

  it("returns 403 for non-admin users", async () => {
    const { user } = await createRealUser("blog-tag-delete-forbidden");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .delete(`/admin/blog-tags/${validId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the tag is still used by a blog", async () => {
    const prisma = await loadPrisma();
    const { user: admin } = await createRealUser("blog-tag-delete-used", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);
    const suffix = Date.now();
    const category = await prisma.blogCategory.create({
      data: {
        name: `Delete Tag Category ${suffix}`,
        slug: `delete-tag-category-${suffix}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedCategoryIds.add(category.id);
    const tag = await prisma.blogTag.create({
      data: {
        name: `Tag Used ${suffix}`,
        slug: `tag-used-${suffix}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedTagIds.add(tag.id);
    const blog = await prisma.blog.create({
      data: {
        userId: admin.id,
        categoryId: category.id,
        title: `Delete Tag Blog ${suffix}`,
        slug: `delete-tag-blog-${suffix}`,
        content: "Blog yang masih menggunakan tag ini.",
        status: "draft",
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: {
          create: [{ tagId: tag.id }],
        },
      },
    });
    trackedBlogIds.add(blog.id);

    const response = await request(app)
      .delete(`/admin/blog-tags/${tag.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe(
      "Tidak dapat menghapus tag yang sedang digunakan oleh blog",
    );
  });
});
