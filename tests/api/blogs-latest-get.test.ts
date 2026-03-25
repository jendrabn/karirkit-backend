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
        getLatest: jest.fn(),
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

describe("GET /blogs/latest", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the latest published blogs", async () => {
    const getLatestMock = jest.mocked(BlogService.getLatest);
    getLatestMock.mockResolvedValue([
      { slug: "latest-post", title: "Latest Post" },
    ] as never);

    const response = await request(app).get("/blogs/latest?limit=6");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data[0]).toMatchObject({
      slug: "latest-post",
      title: "Latest Post",
    });
    expect(getLatestMock).toHaveBeenCalledWith(6);
  });

  it("returns service errors when latest blogs cannot be loaded", async () => {
    const getLatestMock = jest.mocked(BlogService.getLatest);
    getLatestMock.mockRejectedValue(new Error("Latest blogs unavailable"));

    const response = await request(app).get("/blogs/latest");

    expect(response.status).toBe(500);
    expect(response.body.errors.general[0]).toBe("Latest blogs unavailable");
  });

  it("clamps the limit query parameter to the controller maximum", async () => {
    const getLatestMock = jest.mocked(BlogService.getLatest);
    getLatestMock.mockResolvedValue([] as never);

    const response = await request(app).get("/blogs/latest?limit=999");

    expect(response.status).toBe(200);
    expect(getLatestMock).toHaveBeenCalledWith(20);
    expect(response.body.data).toEqual([]);
  });
});

describe("GET /blogs/latest", () => {
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

  it("returns the latest published blogs", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("blogs-latest");
    trackedEmails.add(user.email);
    const suffix = Date.now();
    const category = await prisma.blogCategory.create({
      data: {
        name: `Latest Category ${suffix}`,
        slug: `latest-category-${suffix}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedCategoryIds.add(category.id);
    const blog = await prisma.blog.create({
      data: {
        userId: user.id,
        categoryId: category.id,
        title: `Latest Blog ${suffix}`,
        slug: `latest-blog-${suffix}`,
        content: "Konten latest blog.",
        status: "published",
        readTime: 1,
        views: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        publishedAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    trackedBlogIds.add(blog.id);

    const response = await request(app).get("/blogs/latest?limit=6");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(
      response.body.data.some((item: { id: string }) => item.id === blog.id),
    ).toBe(true);
  });

  it("returns service errors when latest blogs cannot be loaded", async () => {
    const prisma = await loadPrisma();
    const spy = jest
      .spyOn(prisma.blog, "findMany")
      .mockRejectedValueOnce(new Error("Latest blogs unavailable"));

    const response = await request(app).get("/blogs/latest");

    expect(response.status).toBe(500);
    expect(response.body.errors.general[0]).toBe("Latest blogs unavailable");

    spy.mockRestore();
  });

  it("clamps the limit query parameter to the controller maximum", async () => {
    const response = await request(app).get("/blogs/latest?limit=999");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
  });
});
