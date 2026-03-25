import request from "supertest";
import {
  createRealUser,
  deleteUsersByEmail,
  disconnectPrisma,
  loadPrisma,
} from "./real-mode";

let app: typeof import("../../src/index").default;
let BlogService: typeof import("../../src/services/blog.service").BlogService;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/blog.service", () => ({
      BlogService: {
        getPopular: jest.fn(),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ BlogService } = await import("../../src/services/blog.service"));
});

afterAll(async () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    await disconnectPrisma();
  }
});

describe("GET /blogs/popular", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns popular blogs for the requested window", async () => {
    const getPopularMock = jest.mocked(BlogService.getPopular);
    getPopularMock.mockResolvedValue([
      { slug: "popular-post", title: "Popular Post" },
    ] as never);

    const response = await request(app).get("/blogs/popular?limit=5&window=30d");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data[0]).toMatchObject({
      slug: "popular-post",
      title: "Popular Post",
    });
    expect(getPopularMock).toHaveBeenCalledWith(5, "30d");
  });

  it("returns service errors when the popular list cannot be generated", async () => {
    const getPopularMock = jest.mocked(BlogService.getPopular);
    getPopularMock.mockRejectedValue(new Error("Popular blogs unavailable"));

    const response = await request(app).get("/blogs/popular");

    expect(response.status).toBe(500);
    expect(response.body.errors.general[0]).toBe("Popular blogs unavailable");
  });

  it("uses the default window and a clamped limit when the query is extreme", async () => {
    const getPopularMock = jest.mocked(BlogService.getPopular);
    getPopularMock.mockResolvedValue([] as never);

    const response = await request(app).get("/blogs/popular?limit=0");

    expect(response.status).toBe(200);
    expect(getPopularMock).toHaveBeenCalledWith(4, "7d");
    expect(response.body.data).toEqual([]);
  });
});

describe("GET /blogs/popular", () => {
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

  it("returns popular blogs for the requested window", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("blogs-popular");
    trackedEmails.add(user.email);
    const suffix = Date.now();
    const category = await prisma.blogCategory.create({
      data: {
        name: `Popular Category ${suffix}`,
        slug: `popular-category-${suffix}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedCategoryIds.add(category.id);
    const blog = await prisma.blog.create({
      data: {
        userId: user.id,
        categoryId: category.id,
        title: `Popular Blog ${suffix}`,
        slug: `popular-blog-${suffix}`,
        content: "Konten popular blog.",
        status: "published",
        readTime: 1,
        views: 9999,
        createdAt: new Date(),
        updatedAt: new Date(),
        publishedAt: new Date(),
      },
    });
    trackedBlogIds.add(blog.id);

    const response = await request(app).get("/blogs/popular?limit=5&window=30d");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(
      response.body.data.some((item: { id: string }) => item.id === blog.id),
    ).toBe(true);
  });

  it("returns service errors when the popular list cannot be generated", async () => {
    const prisma = await loadPrisma();
    const spy = jest
      .spyOn(prisma.blog, "findMany")
      .mockRejectedValueOnce(new Error("Popular blogs unavailable"));

    const response = await request(app).get("/blogs/popular");

    expect(response.status).toBe(500);
    expect(response.body.errors.general[0]).toBe("Popular blogs unavailable");

    spy.mockRestore();
  });

  it("uses the default window and a clamped limit when the query is extreme", async () => {
    const response = await request(app).get("/blogs/popular?limit=0");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
  });
});
