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
        update: jest.fn(),
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

describe("PUT /admin/blog-categories/:id", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("updates a blog category record", async () => {
    const updateMock = jest.mocked(BlogCategoryService.update);
    updateMock.mockResolvedValue({
      id: validId,
      name: "Blog Category Diperbarui",
    } as never);

    const response = await request(app)
      .put(`/admin/blog-categories/${validId}`)
      .set("Authorization", "Bearer admin-token")
      .send({ name: "Blog Category Diperbarui" });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: validId,
      name: "Blog Category Diperbarui",
    });
    expect(typeof response.body.data.name).toBe("string");
  });

  it("returns 403 when a non-admin user updates the resource", async () => {
    const response = await request(app)
      .put(`/admin/blog-categories/${validId}`)
      .set("Authorization", "Bearer user-token")
      .send({ name: "Blog Category Diperbarui" });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns validation errors for invalid updates", async () => {
    const updateMock = jest.mocked(BlogCategoryService.update);
    updateMock.mockRejectedValue(
      new ResponseErrorClass(400, "Validation error", {
        name: ["String must contain at least 1 character(s)"],
      }),
    );

    const response = await request(app)
      .put(`/admin/blog-categories/${validId}`)
      .set("Authorization", "Bearer admin-token")
      .send({ name: "" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.name");
    expect(Array.isArray(response.body.errors.name)).toBe(true);
  });
});

describe("PUT /admin/blog-categories/:id", () => {
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

  it("updates a blog category record", async () => {
    const prisma = await loadPrisma();
    const { user: admin } = await createRealUser("blog-category-update", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);
    const category = await prisma.blogCategory.create({
      data: {
        name: `Category Update ${Date.now()}`,
        slug: `category-update-${Date.now()}`,
        description: "Deskripsi awal",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedCategoryIds.add(category.id);

    const response = await request(app)
      .put(`/admin/blog-categories/${category.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Blog Category Diperbarui",
        description: "Deskripsi diperbarui",
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: category.id,
      name: "Blog Category Diperbarui",
      description: "Deskripsi diperbarui",
    });
    expect(response.body.data.slug).toBe("blog-category-diperbarui");
  });

  it("returns 403 when a non-admin user updates the resource", async () => {
    const { user } = await createRealUser("blog-category-update-forbidden");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .put(`/admin/blog-categories/${validId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Blog Category Diperbarui" });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns validation errors for invalid updates", async () => {
    const prisma = await loadPrisma();
    const { user: admin } = await createRealUser("blog-category-update-invalid", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);
    const category = await prisma.blogCategory.create({
      data: {
        name: `Category Invalid ${Date.now()}`,
        slug: `category-invalid-${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedCategoryIds.add(category.id);

    const response = await request(app)
      .put(`/admin/blog-categories/${category.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.name");
    expect(Array.isArray(response.body.errors.name)).toBe(true);
  });
});
