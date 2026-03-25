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
        update: jest.fn(),
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

describe("PUT /blogs/admin/:id", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("updates a blog record", async () => {
    const updateMock = jest.mocked(BlogService.update);
    updateMock.mockResolvedValue({ id: validId, title: "Blog Diperbarui" } as never);

    const response = await request(app)
      .put(`/blogs/admin/${validId}`)
      .set("Authorization", "Bearer user-token")
      .send({ title: "Blog Diperbarui" });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({ id: validId, title: "Blog Diperbarui" });
    expect(typeof response.body.data.title).toBe("string");
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app)
      .put(`/blogs/admin/${validId}`)
      .send({ title: "Blog Diperbarui" });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns validation errors for invalid updates", async () => {
    const updateMock = jest.mocked(BlogService.update);
    updateMock.mockRejectedValue(
      new ResponseErrorClass(400, "Validation error", {
        title: ["Judul wajib diisi"],
      }),
    );

    const response = await request(app)
      .put(`/blogs/admin/${validId}`)
      .set("Authorization", "Bearer user-token")
      .send({ title: "" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.title");
    expect(Array.isArray(response.body.errors.title)).toBe(true);
  });
});

describe("PUT /blogs/admin/:id", () => {
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

  it("updates a blog record", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("blogs-update");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const suffix = Date.now();
    const category = await prisma.blogCategory.create({
      data: {
        name: `Update Category ${suffix}`,
        slug: `update-category-${suffix}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedCategoryIds.add(category.id);
    const blog = await prisma.blog.create({
      data: {
        userId: user.id,
        categoryId: category.id,
        title: `Update Blog ${suffix}`,
        slug: `update-blog-${suffix}`,
        content: "Konten update blog.",
        status: "draft",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedBlogIds.add(blog.id);

    const response = await request(app)
      .put(`/blogs/admin/${blog.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Blog Diperbarui",
        excerpt: "Excerpt update",
        content: "Konten diperbarui untuk blog user.",
        status: "published",
        category_id: category.id,
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: blog.id,
      title: "Blog Diperbarui",
      status: "published",
    });
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app)
      .put(`/blogs/admin/${validId}`)
      .send({ title: "Blog Diperbarui" });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns validation errors for invalid updates", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("blogs-update-invalid");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const suffix = Date.now();
    const category = await prisma.blogCategory.create({
      data: {
        name: `Update Invalid Category ${suffix}`,
        slug: `update-invalid-category-${suffix}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedCategoryIds.add(category.id);
    const blog = await prisma.blog.create({
      data: {
        userId: user.id,
        categoryId: category.id,
        title: `Update Invalid Blog ${suffix}`,
        slug: `update-invalid-blog-${suffix}`,
        content: "Konten update invalid blog.",
        status: "draft",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedBlogIds.add(blog.id);

    const response = await request(app)
      .put(`/blogs/admin/${blog.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.title");
    expect(Array.isArray(response.body.errors.title)).toBe(true);
  });
});
