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
        list: jest.fn(),
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

describe("GET /admin/blog-tags", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a paginated blog tag list", async () => {
    const listMock = jest.mocked(BlogTagService.list);
    listMock.mockResolvedValue({
      items: [{ id: validId, name: "Blog Tag 1" }],
      pagination: { page: 1, per_page: 20, total_items: 1, total_pages: 1 },
    } as never);

    const response = await request(app)
      .get("/admin/blog-tags")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body).toHaveProperty("data.pagination");
    expect(Array.isArray(response.body.data.items)).toBe(true);
    expect(response.body.data.items[0]).toMatchObject({
      id: validId,
      name: "Blog Tag 1",
    });
    expect(typeof response.body.data.pagination.total_items).toBe("number");
  });

  it("returns 403 when a non-admin user accesses the endpoint", async () => {
    const response = await request(app)
      .get("/admin/blog-tags")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns validation errors for invalid range filters", async () => {
    const listMock = jest.mocked(BlogTagService.list);
    listMock.mockRejectedValue(
      new ResponseErrorClass(400, "Validation error", {
        blog_count_from: [
          "Jumlah blog minimal tidak boleh lebih besar dari maksimal",
        ],
      }),
    );

    const response = await request(app)
      .get("/admin/blog-tags?blog_count_from=10&blog_count_to=1")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.blog_count_from");
    expect(Array.isArray(response.body.errors.blog_count_from)).toBe(true);
  });
});

describe("GET /admin/blog-tags", () => {
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

  it("returns a paginated blog tag list", async () => {
    const prisma = await loadPrisma();
    const { user: admin } = await createRealUser("blog-tags-list", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);
    const suffix = Date.now();

    const category = await prisma.blogCategory.create({
      data: {
        name: `Tag Category ${suffix}`,
        slug: `tag-category-${suffix}`,
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
        title: `Tag Blog ${suffix}`,
        slug: `tag-blog-${suffix}`,
        content: "Konten blog untuk menghitung jumlah blog pada tag.",
        status: "published",
        readTime: 2,
        views: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
        publishedAt: new Date(),
        tags: {
          create: [{ tagId: tag.id }],
        },
      },
    });
    trackedBlogIds.add(blog.id);

    const response = await request(app)
      .get(`/admin/blog-tags?q=${encodeURIComponent(tag.name)}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body).toHaveProperty("data.pagination");
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0]).toMatchObject({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      blog_count: 1,
    });
    expect(response.body.data.pagination.total_items).toBe(1);
  });

  it("returns 403 when a non-admin user accesses the endpoint", async () => {
    const { user } = await createRealUser("blog-tags-list-forbidden");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .get("/admin/blog-tags")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns validation errors for invalid range filters", async () => {
    const { user: admin } = await createRealUser("blog-tags-invalid", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .get("/admin/blog-tags?blog_count_from=10&blog_count_to=1")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.blog_count_from");
    expect(Array.isArray(response.body.errors.blog_count_from)).toBe(true);
  });
});
