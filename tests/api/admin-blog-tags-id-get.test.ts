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
let BlogTagService: typeof import("../../src/services/admin/blog-tag.service").BlogTagService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/admin/blog-tag.service", () => ({
      BlogTagService: {
        get: jest.fn(),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ BlogTagService } = await import("../../src/services/admin/blog-tag.service"));
  ({ ResponseError: ResponseErrorClass } = await import(
    "../../src/utils/response-error.util"
  ));
});

afterAll(async () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    await disconnectPrisma();
  }
});

describe("GET /admin/blog-tags/:id", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns blog tag details", async () => {
    const getMock = jest.mocked(BlogTagService.get);
    getMock.mockResolvedValue({ id: validId, name: "Blog Tag Detail" } as never);

    const response = await request(app)
      .get(`/admin/blog-tags/${validId}`)
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: validId,
      name: "Blog Tag Detail",
    });
    expect(typeof response.body.data.id).toBe("string");
  });

  it("returns 403 when the requester is not an admin", async () => {
    const response = await request(app)
      .get(`/admin/blog-tags/${validId}`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 404 when the blog tag does not exist", async () => {
    const getMock = jest.mocked(BlogTagService.get);
    getMock.mockRejectedValue(
      new ResponseErrorClass(404, "Tag blog tidak ditemukan"),
    );

    const response = await request(app)
      .get(`/admin/blog-tags/${validId}`)
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Tag blog tidak ditemukan");
  });
});

describe("GET /admin/blog-tags/:id", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();
  const trackedTagIds = new Set<string>();

  afterEach(async () => {
    const prisma = await loadPrisma();
    if (trackedTagIds.size > 0) {
      await prisma.blogTag.deleteMany({
        where: { id: { in: [...trackedTagIds] } },
      });
    }
    trackedTagIds.clear();
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("returns blog tag details", async () => {
    const prisma = await loadPrisma();
    const { user: admin } = await createRealUser("blog-tag-detail", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);
    const tag = await prisma.blogTag.create({
      data: {
        name: `Tag Detail ${Date.now()}`,
        slug: `tag-detail-${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedTagIds.add(tag.id);

    const response = await request(app)
      .get(`/admin/blog-tags/${tag.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      blog_count: 0,
    });
  });

  it("returns 403 when the requester is not an admin", async () => {
    const { user } = await createRealUser("blog-tag-detail-forbidden");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .get(`/admin/blog-tags/${validId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 404 when the blog tag does not exist", async () => {
    const { user: admin } = await createRealUser("blog-tag-detail-missing", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .get("/admin/blog-tags/missing-tag-id")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Tag blog tidak ditemukan");
  });
});
