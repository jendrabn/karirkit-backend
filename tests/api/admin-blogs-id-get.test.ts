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
let BlogService: typeof import("../../src/services/admin/blog.service").BlogService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/admin/blog.service", () => ({
      BlogService: {
        get: jest.fn(),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ BlogService } = await import("../../src/services/admin/blog.service"));
  ({ ResponseError: ResponseErrorClass } = await import(
    "../../src/utils/response-error.util"
  ));
});

afterAll(async () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    await disconnectPrisma();
  }
});

describe("GET /admin/blogs/:id", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns admin blog details", async () => {
    const getMock = jest.mocked(BlogService.get);
    getMock.mockResolvedValue({
      id: validId,
      title: "Admin Blog Detail",
    } as never);

    const response = await request(app)
      .get(`/admin/blogs/${validId}`)
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: validId,
      title: "Admin Blog Detail",
    });
    expect(typeof response.body.data.id).toBe("string");
  });

  it("returns 403 when the requester is not an admin", async () => {
    const response = await request(app)
      .get(`/admin/blogs/${validId}`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 404 when the admin blog does not exist", async () => {
    const getMock = jest.mocked(BlogService.get);
    getMock.mockRejectedValue(
      new ResponseErrorClass(404, "Blog tidak ditemukan"),
    );

    const response = await request(app)
      .get(`/admin/blogs/${validId}`)
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Blog tidak ditemukan");
  });
});

describe("GET /admin/blogs/:id", () => {
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
        where: {
          id: { in: [...trackedBlogIds] },
        },
      });
    }
    if (trackedCategoryIds.size > 0) {
      await prisma.blogCategory.deleteMany({
        where: {
          id: { in: [...trackedCategoryIds] },
        },
      });
    }
    if (trackedTagIds.size > 0) {
      await prisma.blogTag.deleteMany({
        where: {
          id: { in: [...trackedTagIds] },
        },
      });
    }
    trackedBlogIds.clear();
    trackedCategoryIds.clear();
    trackedTagIds.clear();
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("returns admin blog details", async () => {
    const prisma = await loadPrisma();
    const { user: admin } = await createRealUser("admin-blog-detail", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);
    const suffix = Date.now();

    const category = await prisma.blogCategory.create({
      data: {
        name: `Detail Category ${suffix}`,
        slug: `detail-category-${suffix}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedCategoryIds.add(category.id);

    const tag = await prisma.blogTag.create({
      data: {
        name: `Detail Tag ${suffix}`,
        slug: `detail-tag-${suffix}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedTagIds.add(tag.id);

    const blog = await prisma.blog.create({
      data: {
        userId: admin.id,
        categoryId: category.id,
        title: `Admin Blog Detail ${suffix}`,
        slug: `admin-blog-detail-${suffix}`,
        excerpt: "Detail excerpt",
        content: "Konten detail blog admin untuk pengujian endpoint detail.",
        featuredImage: `/uploads/blogs/detail-${suffix}.jpg`,
        status: "published",
        readTime: 4,
        views: 50,
        publishedAt: new Date("2026-03-21T10:00:00.000Z"),
        createdAt: new Date("2026-03-21T10:00:00.000Z"),
        updatedAt: new Date("2026-03-21T10:00:00.000Z"),
        tags: {
          create: [{ tagId: tag.id }],
        },
      },
    });
    trackedBlogIds.add(blog.id);

    const response = await request(app)
      .get(`/admin/blogs/${blog.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: blog.id,
      title: blog.title,
      status: "published",
      user_id: admin.id,
      category_id: category.id,
    });
    expect(response.body.data).toHaveProperty("user");
    expect(response.body.data).toHaveProperty("category");
    expect(Array.isArray(response.body.data.tags)).toBe(true);
    expect(response.body.data.tags[0]).toMatchObject({
      id: tag.id,
      name: tag.name,
    });
  });

  it("returns 403 when the requester is not an admin", async () => {
    const { user } = await createRealUser("admin-blog-detail-forbidden");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .get(`/admin/blogs/${validId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 404 when the admin blog does not exist", async () => {
    const { user: admin } = await createRealUser("admin-blog-detail-missing", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .get("/admin/blogs/missing-blog-id")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Blog tidak ditemukan");
  });
});
