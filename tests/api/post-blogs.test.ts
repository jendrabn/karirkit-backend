import request from "supertest";
import {
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
  loadPrisma,
} from "./real-mode";

let app: typeof import("../../src/index").default;
let BlogService: typeof import("../../src/services/blog.service").BlogService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/blog.service", () => ({
      BlogService: {
        create: jest.fn(),
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

describe("POST /blogs", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a blog record", async () => {
    const createMock = jest.mocked(BlogService.create);
    createMock.mockResolvedValue({
      id: "550e8400-e29b-41d4-a716-446655440000",
      title: "Blog Baru",
    } as never);

    const response = await request(app)
      .post("/blogs")
      .set("Authorization", "Bearer user-token")
      .send({ title: "Blog Baru" });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: "550e8400-e29b-41d4-a716-446655440000",
      title: "Blog Baru",
    });
    expect(typeof response.body.data.id).toBe("string");
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app).post("/blogs").send({ title: "Blog Baru" });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns validation errors for invalid payloads", async () => {
    const createMock = jest.mocked(BlogService.create);
    createMock.mockRejectedValue(
      new ResponseErrorClass(400, "Validation error", {
        title: ["Judul wajib diisi"],
      }),
    );

    const response = await request(app)
      .post("/blogs")
      .set("Authorization", "Bearer user-token")
      .send({ title: "" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.title");
    expect(Array.isArray(response.body.errors.title)).toBe(true);
  });
});

describe("POST /blogs", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();
  const trackedBlogIds = new Set<string>();
  const trackedCategoryIds = new Set<string>();
  const trackedTagIds = new Set<string>();

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
    if (trackedTagIds.size > 0) {
      await prisma.blogTag.deleteMany({ where: { id: { in: [...trackedTagIds] } } });
    }
    trackedBlogIds.clear();
    trackedCategoryIds.clear();
    trackedTagIds.clear();
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("creates a blog record", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("blogs-create");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const suffix = Date.now();
    const category = await prisma.blogCategory.create({
      data: {
        name: `Create Category ${suffix}`,
        slug: `create-category-${suffix}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedCategoryIds.add(category.id);
    const tag = await prisma.blogTag.create({
      data: {
        name: `Create Tag ${suffix}`,
        slug: `create-tag-${suffix}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedTagIds.add(tag.id);

    const response = await request(app)
      .post("/blogs")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: `Blog Baru ${suffix}`,
        excerpt: "Excerpt",
        content: "Konten blog baru untuk pengujian endpoint create.",
        status: "published",
        category_id: category.id,
        tag_ids: [tag.id],
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      title: `Blog Baru ${suffix}`,
      category_id: category.id,
      user_id: user.id,
      status: "published",
    });
    trackedBlogIds.add(response.body.data.id);
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app).post("/blogs").send({ title: "Blog Baru" });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns validation errors for invalid payloads", async () => {
    const { user } = await createRealUser("blogs-create-invalid");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .post("/blogs")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.title");
    expect(Array.isArray(response.body.errors.title)).toBe(true);
  });
});
