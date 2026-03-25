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
let BlogCategoryService: typeof import("../../src/services/admin/blog-category.service").BlogCategoryService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/admin/blog-category.service", () => ({
      BlogCategoryService: {
        get: jest.fn(),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ BlogCategoryService } = await import(
    "../../src/services/admin/blog-category.service"
  ));
  ({ ResponseError: ResponseErrorClass } = await import(
    "../../src/utils/response-error.util"
  ));
});

afterAll(async () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    await disconnectPrisma();
  }
});

describe("GET /admin/blog-categories/:id", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns blog category details", async () => {
    const getMock = jest.mocked(BlogCategoryService.get);
    getMock.mockResolvedValue({
      id: validId,
      name: "Blog Category Detail",
    } as never);

    const response = await request(app)
      .get(`/admin/blog-categories/${validId}`)
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: validId,
      name: "Blog Category Detail",
    });
    expect(typeof response.body.data.id).toBe("string");
  });

  it("returns 403 when the requester is not an admin", async () => {
    const response = await request(app)
      .get(`/admin/blog-categories/${validId}`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 404 when the blog category does not exist", async () => {
    const getMock = jest.mocked(BlogCategoryService.get);
    getMock.mockRejectedValue(
      new ResponseErrorClass(404, "Kategori blog tidak ditemukan"),
    );

    const response = await request(app)
      .get(`/admin/blog-categories/${validId}`)
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Kategori blog tidak ditemukan");
  });
});

describe("GET /admin/blog-categories/:id", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();
  const trackedCategoryIds = new Set<string>();

  afterEach(async () => {
    const prisma = await loadPrisma();
    if (trackedCategoryIds.size > 0) {
      await prisma.blogCategory.deleteMany({
        where: { id: { in: [...trackedCategoryIds] } },
      });
    }
    trackedCategoryIds.clear();
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("returns blog category details", async () => {
    const prisma = await loadPrisma();
    const { user: admin } = await createRealUser("blog-category-detail", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);
    const suffix = Date.now();

    const category = await prisma.blogCategory.create({
      data: {
        name: `Category Detail ${suffix}`,
        slug: `category-detail-${suffix}`,
        description: "Detail kategori",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedCategoryIds.add(category.id);

    const response = await request(app)
      .get(`/admin/blog-categories/${category.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: "Detail kategori",
      blog_count: 0,
    });
  });

  it("returns 403 when the requester is not an admin", async () => {
    const { user } = await createRealUser("blog-category-detail-forbidden");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .get(`/admin/blog-categories/${validId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 404 when the blog category does not exist", async () => {
    const { user: admin } = await createRealUser("blog-category-detail-missing", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .get("/admin/blog-categories/missing-category-id")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Kategori blog tidak ditemukan");
  });
});
