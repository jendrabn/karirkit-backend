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
        list: jest.fn(),
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

describe("GET /admin/blogs", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a paginated admin blog list", async () => {
    const listMock = jest.mocked(BlogService.list);
    listMock.mockResolvedValue({
      items: [{ id: validId, title: "Admin Blog 1" }],
      pagination: { page: 1, per_page: 20, total_items: 1, total_pages: 1 },
    } as never);

    const response = await request(app)
      .get("/admin/blogs")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body).toHaveProperty("data.pagination");
    expect(Array.isArray(response.body.data.items)).toBe(true);
    expect(response.body.data.items[0]).toMatchObject({
      id: validId,
      title: "Admin Blog 1",
    });
    expect(typeof response.body.data.pagination.total_items).toBe("number");
  });

  it("returns 403 when a non-admin user accesses the endpoint", async () => {
    const response = await request(app)
      .get("/admin/blogs")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the blog view range is invalid", async () => {
    const listMock = jest.mocked(BlogService.list);
    listMock.mockRejectedValue(
      new ResponseErrorClass(400, "Validation error", {
        views_from: ["Views minimal tidak boleh lebih besar dari maksimal"],
      }),
    );

    const response = await request(app)
      .get("/admin/blogs?views_from=100&views_to=10")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.views_from");
    expect(Array.isArray(response.body.errors.views_from)).toBe(true);
  });
});

describe("GET /admin/blogs", () => {
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

  it("returns a paginated admin blog list", async () => {
    const prisma = await loadPrisma();
    const { user: admin } = await createRealUser("admin-blogs-list", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);
    const suffix = Date.now();

    const category = await prisma.blogCategory.create({
      data: {
        name: `Category ${suffix}`,
        slug: `category-${suffix}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedCategoryIds.add(category.id);

    const tag = await prisma.blogTag.create({
      data: {
        name: `Tag ${suffix}`,
        slug: `tag-${suffix}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedTagIds.add(tag.id);

    const blog = await prisma.blog.create({
      data: {
        userId: admin.id,
        categoryId: category.id,
        title: `Admin Blog ${suffix}`,
        slug: `admin-blog-${suffix}`,
        excerpt: "Blog excerpt",
        content: "Ini adalah isi blog admin yang cukup panjang untuk pengujian.",
        featuredImage: `/uploads/blogs/featured-${suffix}.jpg`,
        status: "published",
        readTime: 3,
        views: 25,
        publishedAt: new Date("2026-03-20T10:00:00.000Z"),
        createdAt: new Date("2026-03-20T10:00:00.000Z"),
        updatedAt: new Date("2026-03-20T10:00:00.000Z"),
        tags: {
          create: [{ tagId: tag.id }],
        },
      },
    });
    trackedBlogIds.add(blog.id);

    const response = await request(app)
      .get(
        `/admin/blogs?status=published&category_id=${category.id}&user_id=${admin.id}`,
      )
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body).toHaveProperty("data.pagination");
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0]).toMatchObject({
      id: blog.id,
      title: blog.title,
      status: "published",
      user_id: admin.id,
      category_id: category.id,
    });
    expect(response.body.data.items[0]).toHaveProperty("user");
    expect(response.body.data.items[0]).toHaveProperty("category");
    expect(Array.isArray(response.body.data.items[0].tags)).toBe(true);
    expect(response.body.data.pagination.total_items).toBe(1);
  });

  it("returns 403 when a non-admin user accesses the endpoint", async () => {
    const { user } = await createRealUser("admin-blogs-forbidden");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .get("/admin/blogs")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the blog view range is invalid", async () => {
    const { user: admin } = await createRealUser("admin-blogs-invalid", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .get("/admin/blogs?views_from=100&views_to=10")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.views_from");
    expect(Array.isArray(response.body.errors.views_from)).toBe(true);
  });
});
