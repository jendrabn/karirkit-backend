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
        getBySlug: jest.fn(),
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

describe("GET /blogs/:slug", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a blog detail by slug", async () => {
    const getBySlugMock = jest.mocked(BlogService.getBySlug);
    getBySlugMock.mockResolvedValue({
      id: validId,
      slug: "sample-slug",
      title: "Blog Detail",
      tags: [{ id: "tag-1", name: "Career" }],
    } as never);

    const response = await request(app).get("/blogs/sample-slug");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: validId,
      slug: "sample-slug",
      title: "Blog Detail",
    });
    expect(response.body.data.tags[0]).toMatchObject({
      id: "tag-1",
      name: "Career",
    });
    expect(typeof response.body.data.id).toBe("string");
  });

  it("returns 404 when the resource is not found", async () => {
    const getBySlugMock = jest.mocked(BlogService.getBySlug);
    getBySlugMock.mockRejectedValue(
      new ResponseErrorClass(404, "Blog tidak ditemukan"),
    );
    const response = await request(app).get("/blogs/sample-slug");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Blog tidak ditemukan");
  });

  it("supports blogs that have no tags", async () => {
    const getBySlugMock = jest.mocked(BlogService.getBySlug);
    getBySlugMock.mockResolvedValue({
      id: validId,
      slug: "sample-slug",
      title: "Blog Detail",
      tags: [],
    } as never);

    const response = await request(app).get("/blogs/sample-slug");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.tags");
    expect(response.body.data.slug).toBe("sample-slug");
    expect(response.body.data.tags).toEqual([]);
  });
});

describe("GET /blogs/:slug", () => {
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
      await prisma.blog.deleteMany({ where: { id: { in: [...trackedBlogIds] } } });
    }
    if (trackedCategoryIds.size > 0) {
      await prisma.blogCategory.deleteMany({
        where: { id: { in: [...trackedCategoryIds] } },
      });
    }
    if (trackedTagIds.size > 0) {
      await prisma.blogTag.deleteMany({ where: { id: { in: [...trackedTagIds] } } });
    }
    trackedBlogIds.clear();
    trackedCategoryIds.clear();
    trackedTagIds.clear();
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("returns a blog detail by slug", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("blogs-slug");
    trackedEmails.add(user.email);
    const suffix = Date.now();
    const category = await prisma.blogCategory.create({
      data: {
        name: `Slug Category ${suffix}`,
        slug: `slug-category-${suffix}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedCategoryIds.add(category.id);
    const tag = await prisma.blogTag.create({
      data: {
        name: `Slug Tag ${suffix}`,
        slug: `slug-tag-${suffix}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedTagIds.add(tag.id);
    const blog = await prisma.blog.create({
      data: {
        userId: user.id,
        categoryId: category.id,
        title: `Blog Detail ${suffix}`,
        slug: `blog-detail-${suffix}`,
        content: "Konten blog detail untuk pengujian slug endpoint.",
        status: "published",
        readTime: 2,
        views: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        publishedAt: new Date(),
        tags: { create: [{ tagId: tag.id }] },
      },
    });
    trackedBlogIds.add(blog.id);

    const response = await request(app).get(`/blogs/${blog.slug}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: blog.id,
      slug: blog.slug,
      title: blog.title,
    });
    expect(response.body.data.tags[0]).toMatchObject({
      id: tag.id,
      name: tag.name,
    });
  });

  it("returns 404 when the resource is not found", async () => {
    const response = await request(app).get("/blogs/missing-blog");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Blog tidak ditemukan");
  });

  it("supports blogs that have no tags", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("blogs-slug-no-tags");
    trackedEmails.add(user.email);
    const suffix = Date.now();
    const category = await prisma.blogCategory.create({
      data: {
        name: `No Tag Category ${suffix}`,
        slug: `no-tag-category-${suffix}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedCategoryIds.add(category.id);
    const blog = await prisma.blog.create({
      data: {
        userId: user.id,
        categoryId: category.id,
        title: `Blog No Tag ${suffix}`,
        slug: `blog-no-tag-${suffix}`,
        content: "Konten blog tanpa tag.",
        status: "published",
        readTime: 1,
        views: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        publishedAt: new Date(),
      },
    });
    trackedBlogIds.add(blog.id);

    const response = await request(app).get(`/blogs/${blog.slug}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.tags");
    expect(response.body.data.tags).toEqual([]);
  });
});
