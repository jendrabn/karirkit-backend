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
let BlogService: typeof import("../../src/services/blog.service").BlogService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/blog.service", () => ({
      BlogService: {
        get: jest.fn(),
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

describe("GET /blogs/admin/:id", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns blog details", async () => {
    const getMock = jest.mocked(BlogService.get);
    getMock.mockResolvedValue({ id: validId, title: "Blog Detail" } as never);

    const response = await request(app)
      .get(`/blogs/admin/${validId}`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({ id: validId, title: "Blog Detail" });
    expect(typeof response.body.data.id).toBe("string");
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app).get(`/blogs/admin/${validId}`);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 404 when the blog does not exist", async () => {
    const getMock = jest.mocked(BlogService.get);
    getMock.mockRejectedValue(
      new ResponseErrorClass(404, "Blog tidak ditemukan"),
    );

    const response = await request(app)
      .get(`/blogs/admin/${validId}`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Blog tidak ditemukan");
  });
});

describe("GET /blogs/admin/:id", () => {
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

  it("returns blog details", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("blogs-get-owned");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const suffix = Date.now();
    const category = await prisma.blogCategory.create({
      data: {
        name: `Owned Category ${suffix}`,
        slug: `owned-category-${suffix}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedCategoryIds.add(category.id);
    const blog = await prisma.blog.create({
      data: {
        userId: user.id,
        categoryId: category.id,
        title: `Owned Blog ${suffix}`,
        slug: `owned-blog-${suffix}`,
        content: "Konten owned blog.",
        status: "draft",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedBlogIds.add(blog.id);

    const response = await request(app)
      .get(`/blogs/admin/${blog.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: blog.id,
      title: blog.title,
      user_id: user.id,
    });
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app).get(`/blogs/admin/${validId}`);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 404 when the blog does not exist", async () => {
    const { user } = await createRealUser("blogs-get-missing");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .get("/blogs/admin/missing-blog-id")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Blog tidak ditemukan");
  });
});
