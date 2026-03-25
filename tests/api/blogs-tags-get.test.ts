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
        getTags: jest.fn(),
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

describe("GET /blogs/tags", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns blog tags inside data.items", async () => {
    const getTagsMock = jest.mocked(BlogService.getTags);
    getTagsMock.mockResolvedValue([{ id: "tag-1", name: "Interview" }] as never);

    const response = await request(app).get("/blogs/tags");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(Array.isArray(response.body.data.items)).toBe(true);
    expect(response.body.data.items[0]).toMatchObject({
      id: "tag-1",
      name: "Interview",
    });
  });

  it("returns service errors when tags cannot be loaded", async () => {
    const getTagsMock = jest.mocked(BlogService.getTags);
    getTagsMock.mockRejectedValue(
      new ResponseErrorClass(500, "Tag blog gagal dimuat"),
    );

    const response = await request(app).get("/blogs/tags");

    expect(response.status).toBe(500);
    expect(response.body.errors.general[0]).toBe("Tag blog gagal dimuat");
  });

  it("supports an empty tag list", async () => {
    const getTagsMock = jest.mocked(BlogService.getTags);
    getTagsMock.mockResolvedValue([] as never);

    const response = await request(app).get("/blogs/tags");

    expect(response.status).toBe(200);
    expect(response.body.data.items).toEqual([]);
  });
});

describe("GET /blogs/tags", () => {
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

  it("returns blog tags inside data.items", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("blogs-tags");
    trackedEmails.add(user.email);
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
        name: `Interview ${suffix}`,
        slug: `interview-${suffix}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedTagIds.add(tag.id);
    const blog = await prisma.blog.create({
      data: {
        userId: user.id,
        categoryId: category.id,
        title: `Tag Blog ${suffix}`,
        slug: `tag-blog-${suffix}`,
        content: "Konten tag blog.",
        status: "published",
        readTime: 1,
        views: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        publishedAt: new Date(),
        tags: { create: [{ tagId: tag.id }] },
      },
    });
    trackedBlogIds.add(blog.id);

    const response = await request(app).get("/blogs/tags");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data.items)).toBe(true);
    const matched = response.body.data.items.find(
      (item: { id: string }) => item.id === tag.id,
    );
    expect(matched).toMatchObject({
      id: tag.id,
      name: tag.name,
      blog_count: 1,
    });
  });

  it("returns service errors when tags cannot be loaded", async () => {
    const prisma = await loadPrisma();
    const spy = jest
      .spyOn(prisma.blogTag, "findMany")
      .mockRejectedValueOnce(new Error("Tag blog gagal dimuat"));

    const response = await request(app).get("/blogs/tags");

    expect(response.status).toBe(500);
    expect(response.body.errors.general[0]).toBe("Tag blog gagal dimuat");

    spy.mockRestore();
  });

  it("supports tags with zero blog count", async () => {
    const prisma = await loadPrisma();
    const tag = await prisma.blogTag.create({
      data: {
        name: `Empty Tag ${Date.now()}`,
        slug: `empty-tag-${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedTagIds.add(tag.id);

    const response = await request(app).get("/blogs/tags");

    expect(response.status).toBe(200);
    const matched = response.body.data.items.find(
      (item: { id: string }) => item.id === tag.id,
    );
    expect(matched.blog_count).toBe(0);
  });
});
