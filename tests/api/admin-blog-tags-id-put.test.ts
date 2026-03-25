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
        update: jest.fn(),
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

describe("PUT /admin/blog-tags/:id", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("updates a blog tag record", async () => {
    const updateMock = jest.mocked(BlogTagService.update);
    updateMock.mockResolvedValue({
      id: validId,
      name: "Blog Tag Diperbarui",
    } as never);

    const response = await request(app)
      .put(`/admin/blog-tags/${validId}`)
      .set("Authorization", "Bearer admin-token")
      .send({ name: "Blog Tag Diperbarui" });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: validId,
      name: "Blog Tag Diperbarui",
    });
    expect(typeof response.body.data.name).toBe("string");
  });

  it("returns 403 when a non-admin user updates the resource", async () => {
    const response = await request(app)
      .put(`/admin/blog-tags/${validId}`)
      .set("Authorization", "Bearer user-token")
      .send({ name: "Blog Tag Diperbarui" });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns validation errors for invalid updates", async () => {
    const updateMock = jest.mocked(BlogTagService.update);
    updateMock.mockRejectedValue(
      new ResponseErrorClass(400, "Validation error", {
        name: ["String must contain at least 1 character(s)"],
      }),
    );

    const response = await request(app)
      .put(`/admin/blog-tags/${validId}`)
      .set("Authorization", "Bearer admin-token")
      .send({ name: "" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.name");
    expect(Array.isArray(response.body.errors.name)).toBe(true);
  });
});

describe("PUT /admin/blog-tags/:id", () => {
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

  it("updates a blog tag record", async () => {
    const prisma = await loadPrisma();
    const { user: admin } = await createRealUser("blog-tag-update", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);
    const tag = await prisma.blogTag.create({
      data: {
        name: `Tag Update ${Date.now()}`,
        slug: `tag-update-${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedTagIds.add(tag.id);

    const response = await request(app)
      .put(`/admin/blog-tags/${tag.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Blog Tag Diperbarui" });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: tag.id,
      name: "Blog Tag Diperbarui",
    });
    expect(response.body.data.slug).toBe("blog-tag-diperbarui");
  });

  it("returns 403 when a non-admin user updates the resource", async () => {
    const { user } = await createRealUser("blog-tag-update-forbidden");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .put(`/admin/blog-tags/${validId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Blog Tag Diperbarui" });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns validation errors for invalid updates", async () => {
    const prisma = await loadPrisma();
    const { user: admin } = await createRealUser("blog-tag-update-invalid", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);
    const tag = await prisma.blogTag.create({
      data: {
        name: `Tag Invalid ${Date.now()}`,
        slug: `tag-invalid-${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedTagIds.add(tag.id);

    const response = await request(app)
      .put(`/admin/blog-tags/${tag.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.name");
    expect(Array.isArray(response.body.errors.name)).toBe(true);
  });
});
