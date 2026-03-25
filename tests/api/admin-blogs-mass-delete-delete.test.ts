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
        massDelete: jest.fn(),
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

describe("DELETE /admin/blogs/mass-delete", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deletes multiple admin blog records", async () => {
    const massDeleteMock = jest.mocked(BlogService.massDelete);
    massDeleteMock.mockResolvedValue({
      deleted_count: 2,
      ids: [
        "550e8400-e29b-41d4-a716-446655440000",
        "660e8400-e29b-41d4-a716-446655440000",
      ],
    } as never);

    const response = await request(app)
      .delete("/admin/blogs/mass-delete")
      .set("Authorization", "Bearer admin-token")
      .send({
        ids: [
          "550e8400-e29b-41d4-a716-446655440000",
          "660e8400-e29b-41d4-a716-446655440000",
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      deleted_count: 2,
      ids: [
        "550e8400-e29b-41d4-a716-446655440000",
        "660e8400-e29b-41d4-a716-446655440000",
      ],
    });
    expect(typeof response.body.data.deleted_count).toBe("number");
  });

  it("returns 403 for non-admin users", async () => {
    const response = await request(app)
      .delete("/admin/blogs/mass-delete")
      .set("Authorization", "Bearer user-token")
      .send({ ids: ["550e8400-e29b-41d4-a716-446655440000"] });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns validation errors when no ids are provided", async () => {
    const massDeleteMock = jest.mocked(BlogService.massDelete);
    massDeleteMock.mockRejectedValue(
      new ResponseErrorClass(400, "Minimal satu data harus dipilih")
    );

    const response = await request(app)
      .delete("/admin/blogs/mass-delete")
      .set("Authorization", "Bearer admin-token")
      .send({ ids: [] });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Minimal satu data harus dipilih");
  });
});

describe("DELETE /admin/blogs/mass-delete", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();
  const trackedCategoryIds = new Set<string>();
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
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
    trackedCategoryIds.clear();
    trackedBlogIds.clear();
  });

  it("deletes multiple admin blog records", async () => {
    const prisma = await loadPrisma();
    const { user: admin } = await createRealUser("admin-blog-mass-delete-admin", {
      role: "admin",
    });
    const { user: author } = await createRealUser("admin-blog-mass-delete-author");
    trackedEmails.add(admin.email);
    trackedEmails.add(author.email);
    const token = await createSessionToken(admin);
    const suffix = Date.now();
    const category = await prisma.blogCategory.create({
      data: {
        name: `Mass Delete Category ${suffix}`,
        slug: `mass-delete-category-${suffix}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedCategoryIds.add(category.id);
    const blogs = await Promise.all(
      ["alpha", "beta"].map((name) =>
        prisma.blog.create({
          data: {
            userId: author.id,
            categoryId: category.id,
            title: `Blog ${name} ${suffix}`,
            slug: `blog-${name}-${suffix}`,
            content: `Konten ${name}`,
            status: "draft",
            readTime: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        })
      )
    );

    const response = await request(app)
      .delete("/admin/blogs/mass-delete")
      .set("Authorization", `Bearer ${token}`)
      .send({ ids: blogs.map((blog) => blog.id) });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      deleted_count: 2,
    });

    const remaining = await prisma.blog.findMany({
      where: { id: { in: blogs.map((blog) => blog.id) } },
    });
    expect(remaining).toHaveLength(0);
  });

  it("returns 403 for non-admin users", async () => {
    const { user } = await createRealUser("admin-blog-mass-delete-forbidden");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .delete("/admin/blogs/mass-delete")
      .set("Authorization", `Bearer ${token}`)
      .send({ ids: ["550e8400-e29b-41d4-a716-446655440000"] });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns errors when one of the blogs is missing", async () => {
    const prisma = await loadPrisma();
    const { user: admin } = await createRealUser("admin-blog-mass-delete-missing", {
      role: "admin",
    });
    const { user: author } = await createRealUser(
      "admin-blog-mass-delete-missing-author"
    );
    trackedEmails.add(admin.email);
    trackedEmails.add(author.email);
    const token = await createSessionToken(admin);
    const suffix = Date.now();
    const category = await prisma.blogCategory.create({
      data: {
        name: `Mass Delete Category Missing ${suffix}`,
        slug: `mass-delete-category-missing-${suffix}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedCategoryIds.add(category.id);
    const blog = await prisma.blog.create({
      data: {
        userId: author.id,
        categoryId: category.id,
        title: `Blog Missing ${suffix}`,
        slug: `blog-missing-${suffix}`,
        content: "Konten missing",
        status: "draft",
        readTime: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedBlogIds.add(blog.id);

    const response = await request(app)
      .delete("/admin/blogs/mass-delete")
      .set("Authorization", `Bearer ${token}`)
      .send({
        ids: [blog.id, "550e8400-e29b-41d4-a716-446655440099"],
      });

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe(
      "Satu atau lebih blog tidak ditemukan"
    );
  });
});
