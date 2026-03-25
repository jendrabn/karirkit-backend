import request from "supertest";
import {
  createRealUser,
  deleteUsersByEmail,
  disconnectPrisma,
  loadPrisma,
} from "./real-mode";

const validId = "550e8400-e29b-41d4-a716-446655440000";
let app: typeof import("../../src/index").default;
let BlogService: typeof import("../../src/services/blog.service").BlogService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/blog.service", () => ({
      BlogService: {
        list: jest.fn(),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ BlogService } = await import("../../src/services/blog.service"));
  ({ ResponseError: ResponseErrorClass } = await import(
    "../../src/utils/response-error.util"
  ));
});

afterAll(async () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    await disconnectPrisma();
  }
});

describe("GET /blogs", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a paginated blog list", async () => {
    const listMock = jest.mocked(BlogService.list);
    listMock.mockResolvedValue({
      items: [{ id: validId, title: "Blog 1" }],
      pagination: { page: 1, per_page: 20, total_items: 1, total_pages: 1 },
    } as never);

    const response = await request(app).get("/blogs");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body).toHaveProperty("data.pagination");
    expect(Array.isArray(response.body.data.items)).toBe(true);
    expect(response.body.data.items[0]).toMatchObject({
      id: validId,
      title: "Blog 1",
    });
    expect(typeof response.body.data.pagination.total_items).toBe("number");
  });

  it("returns 400 when the service rejects the request", async () => {
    const listMock = jest.mocked(BlogService.list);
    listMock.mockRejectedValue(
      new ResponseErrorClass(400, "Permintaan tidak valid"),
    );

    const response = await request(app).get("/blogs");

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Permintaan tidak valid");
  });

  it("supports an empty blog state", async () => {
    const listMock = jest.mocked(BlogService.list);
    listMock.mockResolvedValue({
      items: [],
      pagination: { page: 1, per_page: 20, total_items: 0, total_pages: 0 },
    } as never);

    const response = await request(app).get("/blogs");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body.data.items).toEqual([]);
    expect(response.body.data.pagination.total_items).toBe(0);
  });
});

describe("GET /blogs", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();
  const trackedBlogIds = new Set<string>();
  const trackedCategoryIds = new Set<string>();

  afterEach(async () => {
    const prisma = await loadPrisma();
    if (trackedBlogIds.size > 0) {
      await prisma.blog.deleteMany({ where: { id: { in: [...trackedBlogIds] } } });
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

  it("returns a paginated blog list", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("blogs-list");
    trackedEmails.add(user.email);
    const suffix = Date.now();
    const category = await prisma.blogCategory.create({
      data: {
        name: `Blogs Category ${suffix}`,
        slug: `blogs-category-${suffix}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedCategoryIds.add(category.id);
    const blog = await prisma.blog.create({
      data: {
        userId: user.id,
        categoryId: category.id,
        title: `Public Blog ${suffix}`,
        slug: `public-blog-${suffix}`,
        excerpt: "Excerpt",
        content: "Konten blog publik untuk pengujian list endpoint.",
        status: "published",
        readTime: 2,
        views: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        publishedAt: new Date(),
      },
    });
    trackedBlogIds.add(blog.id);

    const response = await request(app).get(
      `/blogs?q=${encodeURIComponent(blog.title)}&category_id=${category.id}`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body).toHaveProperty("data.pagination");
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0]).toMatchObject({
      id: blog.id,
      title: blog.title,
      slug: blog.slug,
      category_id: category.id,
    });
  });

  it("returns 400 when the query is invalid", async () => {
    const response = await request(app).get("/blogs?per_page=0");

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.per_page");
    expect(Array.isArray(response.body.errors.per_page)).toBe(true);
  });

  it("supports an empty blog state", async () => {
    const response = await request(app).get(
      `/blogs?q=${encodeURIComponent(`missing-${Date.now()}`)}`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body.data.items).toEqual([]);
  });
});
