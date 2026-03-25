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
        delete: jest.fn(),
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

describe("DELETE /blogs/admin/:id", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deletes the blog resource", async () => {
    const deleteMock = jest.mocked(BlogService.delete);
    deleteMock.mockResolvedValue(undefined as never);

    const response = await request(app)
      .delete(`/blogs/admin/${validId}`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app).delete(`/blogs/admin/${validId}`);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 404 when the blog cannot be found", async () => {
    const deleteMock = jest.mocked(BlogService.delete);
    deleteMock.mockRejectedValue(
      new ResponseErrorClass(404, "Blog tidak ditemukan"),
    );

    const response = await request(app)
      .delete(`/blogs/admin/${validId}`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Blog tidak ditemukan");
  });
});

describe("DELETE /blogs/admin/:id", () => {
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

  it("deletes the blog resource", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("blogs-delete");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const suffix = Date.now();
    const category = await prisma.blogCategory.create({
      data: {
        name: `Delete Category ${suffix}`,
        slug: `delete-category-${suffix}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedCategoryIds.add(category.id);
    const blog = await prisma.blog.create({
      data: {
        userId: user.id,
        categoryId: category.id,
        title: `Delete Blog ${suffix}`,
        slug: `delete-blog-${suffix}`,
        content: "Konten delete blog.",
        status: "draft",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const response = await request(app)
      .delete(`/blogs/admin/${blog.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(204);

    const found = await prisma.blog.findUnique({ where: { id: blog.id } });
    expect(found).toBeNull();
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app).delete(`/blogs/admin/${validId}`);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 404 when the blog cannot be found", async () => {
    const { user } = await createRealUser("blogs-delete-missing");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .delete("/blogs/admin/missing-blog-id")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Blog tidak ditemukan");
  });
});
