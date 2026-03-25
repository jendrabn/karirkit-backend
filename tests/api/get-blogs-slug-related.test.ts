import request from "supertest";
import {
  createRealUser,
  deleteUsersByEmail,
  disconnectPrisma,
  loadPrisma,
} from "./real-mode";

let app: typeof import("../../src/index").default;
let BlogService: typeof import("../../src/services/blog.service").BlogService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/blog.service", () => ({
      BlogService: {
        getRelatedBlogs: jest.fn(),
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

describe("GET /blogs/:slug/related", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns related blogs for the requested slug", async () => {
    const getRelatedBlogsMock = jest.mocked(BlogService.getRelatedBlogs);
    getRelatedBlogsMock.mockResolvedValue([
      { slug: "related-post", title: "Related Post" },
    ] as never);

    const response = await request(app).get("/blogs/sample-slug/related?limit=3");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data[0]).toMatchObject({
      slug: "related-post",
      title: "Related Post",
    });
    expect(getRelatedBlogsMock).toHaveBeenCalledWith("sample-slug", 3);
  });

  it("returns 404 when the source blog cannot be found", async () => {
    const getRelatedBlogsMock = jest.mocked(BlogService.getRelatedBlogs);
    getRelatedBlogsMock.mockRejectedValue(
      new ResponseErrorClass(404, "Blog tidak ditemukan"),
    );

    const response = await request(app).get("/blogs/missing/related");

    expect(response.status).toBe(404);
    expect(response.body.errors.general[0]).toBe("Blog tidak ditemukan");
  });

  it("supports an empty related blog list", async () => {
    const getRelatedBlogsMock = jest.mocked(BlogService.getRelatedBlogs);
    getRelatedBlogsMock.mockResolvedValue([] as never);

    const response = await request(app).get("/blogs/sample-slug/related");

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
  });
});

describe("GET /blogs/:slug/related", () => {
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

  it("returns related blogs for the requested slug", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("blogs-related");
    trackedEmails.add(user.email);
    const suffix = Date.now();
    const category = await prisma.blogCategory.create({
      data: {
        name: `Related Category ${suffix}`,
        slug: `related-category-${suffix}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedCategoryIds.add(category.id);
    const tag = await prisma.blogTag.create({
      data: {
        name: `Related Tag ${suffix}`,
        slug: `related-tag-${suffix}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedTagIds.add(tag.id);
    const sourceBlog = await prisma.blog.create({
      data: {
        userId: user.id,
        categoryId: category.id,
        title: `Source Blog ${suffix}`,
        slug: `source-blog-${suffix}`,
        content: "Source content",
        status: "published",
        readTime: 2,
        views: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        publishedAt: new Date(),
        tags: { create: [{ tagId: tag.id }] },
      },
    });
    const relatedBlog = await prisma.blog.create({
      data: {
        userId: user.id,
        categoryId: category.id,
        title: `Related Blog ${suffix}`,
        slug: `related-blog-${suffix}`,
        content: "Related content",
        status: "published",
        readTime: 2,
        views: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
        publishedAt: new Date(),
        tags: { create: [{ tagId: tag.id }] },
      },
    });
    trackedBlogIds.add(sourceBlog.id);
    trackedBlogIds.add(relatedBlog.id);

    const response = await request(app).get(
      `/blogs/${sourceBlog.slug}/related?limit=3`,
    );

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(
      response.body.data.some((item: { id: string }) => item.id === relatedBlog.id),
    ).toBe(true);
  });

  it("returns 404 when the source blog cannot be found", async () => {
    const response = await request(app).get("/blogs/missing/related");

    expect(response.status).toBe(404);
    expect(response.body.errors.general[0]).toBe("Blog tidak ditemukan");
  });

  it("supports an empty related blog list", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("blogs-related-empty");
    trackedEmails.add(user.email);
    const suffix = Date.now();
    const category = await prisma.blogCategory.create({
      data: {
        name: `Related Empty Category ${suffix}`,
        slug: `related-empty-category-${suffix}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedCategoryIds.add(category.id);
    const sourceBlog = await prisma.blog.create({
      data: {
        userId: user.id,
        categoryId: category.id,
        title: `Source Empty ${suffix}`,
        slug: `source-empty-${suffix}`,
        content: "Source empty content",
        status: "published",
        readTime: 1,
        views: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        publishedAt: new Date(),
      },
    });
    trackedBlogIds.add(sourceBlog.id);

    const response = await request(app).get(`/blogs/${sourceBlog.slug}/related`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
  });
});
