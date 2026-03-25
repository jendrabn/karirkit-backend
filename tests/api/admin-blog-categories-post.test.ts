import request from "supertest";
import {
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
  loadPrisma,
} from "./real-mode";

let app: typeof import("../../src/index").default;
let BlogCategoryService: typeof import("../../src/services/admin/blog-category.service").BlogCategoryService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/admin/blog-category.service", () => ({
      BlogCategoryService: {
        create: jest.fn(),
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

describe("POST /admin/blog-categories", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a blog category record", async () => {
    const createMock = jest.mocked(BlogCategoryService.create);
    createMock.mockResolvedValue({
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Blog Category Baru",
    } as never);

    const response = await request(app)
      .post("/admin/blog-categories")
      .set("Authorization", "Bearer admin-token")
      .send({ name: "Blog Category Baru" });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Blog Category Baru",
    });
    expect(typeof response.body.data.id).toBe("string");
  });

  it("returns 403 when a non-admin user calls the endpoint", async () => {
    const response = await request(app)
      .post("/admin/blog-categories")
      .set("Authorization", "Bearer user-token")
      .send({ name: "Blog Category Baru" });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns validation errors for invalid payloads", async () => {
    const createMock = jest.mocked(BlogCategoryService.create);
    createMock.mockRejectedValue(
      new ResponseErrorClass(400, "Validation error", {
        name: ["String must contain at least 1 character(s)"],
      }),
    );

    const response = await request(app)
      .post("/admin/blog-categories")
      .set("Authorization", "Bearer admin-token")
      .send({ name: "" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.name");
    expect(Array.isArray(response.body.errors.name)).toBe(true);
  });
});

describe("POST /admin/blog-categories", () => {
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

  it("creates a blog category record", async () => {
    const { user: admin } = await createRealUser("blog-category-create", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .post("/admin/blog-categories")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: `Blog Category Baru ${Date.now()}`,
        description: "Deskripsi kategori baru",
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toHaveProperty("id");
    expect(response.body.data).toHaveProperty("slug");
    expect(response.body.data.description).toBe("Deskripsi kategori baru");
    trackedCategoryIds.add(response.body.data.id);
  });

  it("returns 403 when a non-admin user calls the endpoint", async () => {
    const { user } = await createRealUser("blog-category-create-forbidden");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .post("/admin/blog-categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Blog Category Baru" });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns validation errors for invalid payloads", async () => {
    const { user: admin } = await createRealUser("blog-category-create-invalid", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .post("/admin/blog-categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.name");
    expect(Array.isArray(response.body.errors.name)).toBe(true);
  });
});
