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
        getCategories: jest.fn(),
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

describe("GET /blogs/categories", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns blog categories inside data.items", async () => {
    const getCategoriesMock = jest.mocked(BlogService.getCategories);
    getCategoriesMock.mockResolvedValue([{ id: "cat-1", name: "Career" }] as never);

    const response = await request(app).get("/blogs/categories");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(Array.isArray(response.body.data.items)).toBe(true);
    expect(response.body.data.items[0]).toMatchObject({
      id: "cat-1",
      name: "Career",
    });
  });

  it("returns service errors when categories cannot be loaded", async () => {
    const getCategoriesMock = jest.mocked(BlogService.getCategories);
    getCategoriesMock.mockRejectedValue(
      new ResponseErrorClass(500, "Kategori blog gagal dimuat"),
    );

    const response = await request(app).get("/blogs/categories");

    expect(response.status).toBe(500);
    expect(response.body.errors.general[0]).toBe("Kategori blog gagal dimuat");
  });

  it("supports an empty category list", async () => {
    const getCategoriesMock = jest.mocked(BlogService.getCategories);
    getCategoriesMock.mockResolvedValue([] as never);

    const response = await request(app).get("/blogs/categories");

    expect(response.status).toBe(200);
    expect(response.body.data.items).toEqual([]);
  });
});

describe("GET /blogs/categories", () => {
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

  it("returns blog categories inside data.items", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("blogs-categories");
    trackedEmails.add(user.email);
    const suffix = Date.now();
    const category = await prisma.blogCategory.create({
      data: {
        name: `Career ${suffix}`,
        slug: `career-${suffix}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedCategoryIds.add(category.id);
    const blog = await prisma.blog.create({
      data: {
        userId: user.id,
        categoryId: category.id,
        title: `Category Blog ${suffix}`,
        slug: `category-blog-${suffix}`,
        content: "Konten category blog.",
        status: "published",
        readTime: 1,
        views: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        publishedAt: new Date(),
      },
    });
    trackedBlogIds.add(blog.id);

    const response = await request(app).get("/blogs/categories");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data.items)).toBe(true);
    const matched = response.body.data.items.find(
      (item: { id: string }) => item.id === category.id,
    );
    expect(matched).toMatchObject({
      id: category.id,
      name: category.name,
      blog_count: 1,
    });
  });

  it("returns service errors when categories cannot be loaded", async () => {
    const prisma = await loadPrisma();
    const spy = jest
      .spyOn(prisma.blogCategory, "findMany")
      .mockRejectedValueOnce(new Error("Kategori blog gagal dimuat"));

    const response = await request(app).get("/blogs/categories");

    expect(response.status).toBe(500);
    expect(response.body.errors.general[0]).toBe("Kategori blog gagal dimuat");

    spy.mockRestore();
  });

  it("supports categories with zero blog count", async () => {
    const prisma = await loadPrisma();
    const category = await prisma.blogCategory.create({
      data: {
        name: `Empty Category ${Date.now()}`,
        slug: `empty-category-${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedCategoryIds.add(category.id);

    const response = await request(app).get("/blogs/categories");

    expect(response.status).toBe(200);
    const matched = response.body.data.items.find(
      (item: { id: string }) => item.id === category.id,
    );
    expect(matched.blog_count).toBe(0);
  });
});
