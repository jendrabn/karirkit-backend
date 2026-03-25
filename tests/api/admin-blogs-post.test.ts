import request from "supertest";
import {
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
  loadPrisma,
} from "./real-mode";

let app: typeof import("../../src/index").default;
let BlogService: typeof import("../../src/services/admin/blog.service").BlogService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/admin/blog.service", () => ({
      BlogService: {
        create: jest.fn(),
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

describe("POST /admin/blogs", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates an admin blog record", async () => {
    const createMock = jest.mocked(BlogService.create);
    createMock.mockResolvedValue({
      id: "550e8400-e29b-41d4-a716-446655440000",
      title: "Admin Blog Baru",
    } as never);

    const response = await request(app)
      .post("/admin/blogs")
      .set("Authorization", "Bearer admin-token")
      .send({ title: "Admin Blog Baru" });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: "550e8400-e29b-41d4-a716-446655440000",
      title: "Admin Blog Baru",
    });
    expect(typeof response.body.data.id).toBe("string");
  });

  it("returns 403 when a non-admin user calls the endpoint", async () => {
    const response = await request(app)
      .post("/admin/blogs")
      .set("Authorization", "Bearer user-token")
      .send({ title: "Admin Blog Baru" });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns validation errors for invalid payloads", async () => {
    const createMock = jest.mocked(BlogService.create);
    createMock.mockRejectedValue(
      new ResponseErrorClass(400, "Payload tidak valid")
    );

    const response = await request(app)
      .post("/admin/blogs")
      .set("Authorization", "Bearer admin-token")
      .send({ title: "" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Payload tidak valid");
  });
});

describe("POST /admin/blogs", () => {
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

  it("creates an admin blog record", async () => {
    const prisma = await loadPrisma();
    const { user: admin } = await createRealUser("admin-blog-create-admin", {
      role: "admin",
    });
    const { user: author } = await createRealUser("admin-blog-create-author");
    trackedEmails.add(admin.email);
    trackedEmails.add(author.email);
    const token = await createSessionToken(admin);
    const suffix = Date.now();
    const category = await prisma.blogCategory.create({
      data: {
        name: `Category ${suffix}`,
        slug: `category-${suffix}`,
        description: "Kategori test",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const tag = await prisma.blogTag.create({
      data: {
        name: `Tag ${suffix}`,
        slug: `tag-${suffix}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedCategoryIds.add(category.id);
    trackedTagIds.add(tag.id);

    const response = await request(app)
      .post("/admin/blogs")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: `Admin Blog Baru ${suffix}`,
        excerpt: "Ringkasan blog",
        content: "Konten blog yang cukup panjang untuk test.",
        featured_image: "https://example.com/blog-cover.jpg",
        status: "published",
        category_id: category.id,
        author_id: author.id,
        tag_ids: [tag.id],
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      title: `Admin Blog Baru ${suffix}`,
      status: "published",
      category_id: category.id,
      user_id: author.id,
      featured_image: "https://example.com/blog-cover.jpg",
    });
    expect(response.body.data.slug).toContain(`admin-blog-baru-${suffix}`);
    expect(Array.isArray(response.body.data.tags)).toBe(true);
    expect(response.body.data.tags[0]).toMatchObject({ id: tag.id });
    trackedBlogIds.add(response.body.data.id);
  });

  it("returns 403 when a non-admin user calls the endpoint", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("admin-blog-create-forbidden");
    const { user: author } = await createRealUser(
      "admin-blog-create-forbidden-author"
    );
    trackedEmails.add(user.email);
    trackedEmails.add(author.email);
    const token = await createSessionToken(user);
    const suffix = Date.now();
    const category = await prisma.blogCategory.create({
      data: {
        name: `Category Forbidden ${suffix}`,
        slug: `category-forbidden-${suffix}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedCategoryIds.add(category.id);

    const response = await request(app)
      .post("/admin/blogs")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Admin Blog Baru",
        content: "Konten blog yang cukup panjang.",
        status: "draft",
        category_id: category.id,
        author_id: author.id,
      });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns errors when the referenced category does not exist", async () => {
    const { user: admin } = await createRealUser("admin-blog-create-invalid", {
      role: "admin",
    });
    const { user: author } = await createRealUser(
      "admin-blog-create-invalid-author"
    );
    trackedEmails.add(admin.email);
    trackedEmails.add(author.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .post("/admin/blogs")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Admin Blog Invalid Category",
        content: "Konten blog yang cukup panjang.",
        status: "draft",
        category_id: "550e8400-e29b-41d4-a716-446655440099",
        author_id: author.id,
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Kategori tidak ditemukan");
  });
});
