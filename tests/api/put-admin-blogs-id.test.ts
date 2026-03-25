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
let BlogService: typeof import("../../src/services/admin/blog.service").BlogService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/admin/blog.service", () => ({
      BlogService: {
        update: jest.fn(),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ BlogService } = await import("../../src/services/admin/blog.service"));
  ({ ResponseError: ResponseErrorClass } = await import(
    "../../src/utils/response-error.util"
  ));
});

afterAll(async () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    await disconnectPrisma();
  }
});

describe("PUT /admin/blogs/:id", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("updates an admin blog record", async () => {
    const updateMock = jest.mocked(BlogService.update);
    updateMock.mockResolvedValue({
      id: validId,
      title: "Admin Blog Diperbarui",
    } as never);

    const response = await request(app)
      .put(`/admin/blogs/${validId}`)
      .set("Authorization", "Bearer admin-token")
      .send({ title: "Admin Blog Diperbarui" });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: validId,
      title: "Admin Blog Diperbarui",
    });
    expect(typeof response.body.data.title).toBe("string");
  });

  it("returns 403 when a non-admin user updates the resource", async () => {
    const response = await request(app)
      .put(`/admin/blogs/${validId}`)
      .set("Authorization", "Bearer user-token")
      .send({ title: "Admin Blog Diperbarui" });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns validation errors for invalid updates", async () => {
    const updateMock = jest.mocked(BlogService.update);
    updateMock.mockRejectedValue(
      new ResponseErrorClass(400, "Payload tidak valid")
    );

    const response = await request(app)
      .put(`/admin/blogs/${validId}`)
      .set("Authorization", "Bearer admin-token")
      .send({ title: "" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Payload tidak valid");
  });
});

describe("PUT /admin/blogs/:id", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();
  const trackedCategoryIds = new Set<string>();
  const trackedTagIds = new Set<string>();
  const trackedBlogIds = new Set<string>();

  afterEach(async () => {
    const prisma = await loadPrisma();
    if (trackedBlogIds.size > 0) {
      await prisma.blog.deleteMany({
        where: { id: { in: [...trackedBlogIds] } },
      });
    }
    if (trackedCategoryIds.size > 0) {
      await prisma.blogCategory.deleteMany({
        where: { id: { in: [...trackedCategoryIds] } },
      });
    }
    if (trackedTagIds.size > 0) {
      await prisma.blogTag.deleteMany({
        where: { id: { in: [...trackedTagIds] } },
      });
    }
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
    trackedCategoryIds.clear();
    trackedTagIds.clear();
    trackedBlogIds.clear();
  });

  it("updates an admin blog record", async () => {
    const prisma = await loadPrisma();
    const { user: admin } = await createRealUser("admin-blog-update-admin", {
      role: "admin",
    });
    const { user: author } = await createRealUser("admin-blog-update-author");
    trackedEmails.add(admin.email);
    trackedEmails.add(author.email);
    const token = await createSessionToken(admin);
    const suffix = Date.now();
    const oldCategory = await prisma.blogCategory.create({
      data: {
        name: `Old Category ${suffix}`,
        slug: `old-category-${suffix}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const newCategory = await prisma.blogCategory.create({
      data: {
        name: `New Category ${suffix}`,
        slug: `new-category-${suffix}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const oldTag = await prisma.blogTag.create({
      data: {
        name: `Old Tag ${suffix}`,
        slug: `old-tag-${suffix}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const newTag = await prisma.blogTag.create({
      data: {
        name: `New Tag ${suffix}`,
        slug: `new-tag-${suffix}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedCategoryIds.add(oldCategory.id);
    trackedCategoryIds.add(newCategory.id);
    trackedTagIds.add(oldTag.id);
    trackedTagIds.add(newTag.id);
    const blog = await prisma.blog.create({
      data: {
        userId: author.id,
        categoryId: oldCategory.id,
        title: `Old Blog ${suffix}`,
        slug: `old-blog-${suffix}`,
        excerpt: "Ringkasan lama",
        content: "Konten lama",
        status: "draft",
        readTime: 1,
        featuredImage: "https://example.com/old-cover.jpg",
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: {
          create: [{ tagId: oldTag.id }],
        },
      },
    });
    trackedBlogIds.add(blog.id);

    const response = await request(app)
      .put(`/admin/blogs/${blog.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: `Updated Blog ${suffix}`,
        content: "Konten baru yang lebih panjang.",
        status: "published",
        category_id: newCategory.id,
        tag_ids: [newTag.id],
        featured_image: "https://example.com/new-cover.jpg",
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: blog.id,
      title: `Updated Blog ${suffix}`,
      category_id: newCategory.id,
      status: "published",
      featured_image: "https://example.com/new-cover.jpg",
    });
    expect(Array.isArray(response.body.data.tags)).toBe(true);
    expect(response.body.data.tags[0]).toMatchObject({ id: newTag.id });
  });

  it("returns 403 when a non-admin user updates the resource", async () => {
    const { user } = await createRealUser("admin-blog-update-forbidden");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .put(`/admin/blogs/${validId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Admin Blog Diperbarui" });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 404 when the blog does not exist", async () => {
    const { user: admin } = await createRealUser("admin-blog-update-missing", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .put("/admin/blogs/550e8400-e29b-41d4-a716-446655440099")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Blog Tidak Ada" });

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Blog tidak ditemukan");
  });
});
