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
let BlogCategoryService: typeof import("../../src/services/admin/blog-category.service").BlogCategoryService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/admin/blog-category.service", () => ({
      BlogCategoryService: {
        list: jest.fn(),
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

describe("GET /admin/blog-categories", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a paginated blog category list", async () => {
    const listMock = jest.mocked(BlogCategoryService.list);
    listMock.mockResolvedValue({
      items: [{ id: validId, name: "Blog Category 1" }],
      pagination: { page: 1, per_page: 20, total_items: 1, total_pages: 1 },
    } as never);

    const response = await request(app)
      .get("/admin/blog-categories")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body).toHaveProperty("data.pagination");
    expect(Array.isArray(response.body.data.items)).toBe(true);
    expect(response.body.data.items[0]).toMatchObject({
      id: validId,
      name: "Blog Category 1",
    });
    expect(typeof response.body.data.pagination.total_items).toBe("number");
  });

  it("returns 403 when a non-admin user accesses the endpoint", async () => {
    const response = await request(app)
      .get("/admin/blog-categories")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns validation errors for invalid range filters", async () => {
    const listMock = jest.mocked(BlogCategoryService.list);
    listMock.mockRejectedValue(
      new ResponseErrorClass(400, "Validation error", {
        blog_count_from: [
          "Jumlah blog minimal tidak boleh lebih besar dari maksimal",
        ],
      }),
    );

    const response = await request(app)
      .get("/admin/blog-categories?blog_count_from=10&blog_count_to=1")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.blog_count_from");
    expect(Array.isArray(response.body.errors.blog_count_from)).toBe(true);
  });
});

describe("GET /admin/blog-categories", () => {
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

  it("returns a paginated blog category list", async () => {
    const prisma = await loadPrisma();
    const { user: admin } = await createRealUser("blog-categories-list", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);
    const suffix = Date.now();

    const category = await prisma.blogCategory.create({
      data: {
        name: `Category ${suffix}`,
        slug: `category-${suffix}`,
        description: "Deskripsi kategori",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedCategoryIds.add(category.id);

    const blog = await prisma.blog.create({
      data: {
        userId: admin.id,
        categoryId: category.id,
        title: `Blog ${suffix}`,
        slug: `blog-category-${suffix}`,
        excerpt: "Excerpt",
        content: "Konten blog untuk menghitung jumlah blog kategori.",
        status: "published",
        readTime: 2,
        views: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
        publishedAt: new Date(),
      },
    });
    trackedBlogIds.add(blog.id);

    const response = await request(app)
      .get(`/admin/blog-categories?q=${encodeURIComponent(category.name)}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body).toHaveProperty("data.pagination");
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0]).toMatchObject({
      id: category.id,
      name: category.name,
      slug: category.slug,
      blog_count: 1,
    });
    expect(response.body.data.pagination.total_items).toBe(1);
  });

  it("returns 403 when a non-admin user accesses the endpoint", async () => {
    const { user } = await createRealUser("blog-categories-list-forbidden");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .get("/admin/blog-categories")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns validation errors for invalid range filters", async () => {
    const { user: admin } = await createRealUser("blog-categories-invalid", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .get("/admin/blog-categories?blog_count_from=10&blog_count_to=1")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.blog_count_from");
    expect(Array.isArray(response.body.errors.blog_count_from)).toBe(true);
  });
});
