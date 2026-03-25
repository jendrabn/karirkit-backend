import request from "supertest";
import {
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
  loadPrisma,
} from "./real-mode";

let app: typeof import("../../src/index").default;
let BlogTagService: typeof import("../../src/services/admin/blog-tag.service").BlogTagService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/admin/blog-tag.service", () => ({
      BlogTagService: {
        massDelete: jest.fn(),
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

describe("DELETE /admin/blog-tags/mass-delete", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deletes multiple blog tag records", async () => {
    const massDeleteMock = jest.mocked(BlogTagService.massDelete);
    massDeleteMock.mockResolvedValue({
      deleted_count: 2,
      message: "2 tag blog berhasil dihapus",
    } as never);

    const response = await request(app)
      .delete("/admin/blog-tags/mass-delete")
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
      message: "2 tag blog berhasil dihapus",
    });
    expect(typeof response.body.data.deleted_count).toBe("number");
  });

  it("returns 403 for non-admin users", async () => {
    const response = await request(app)
      .delete("/admin/blog-tags/mass-delete")
      .set("Authorization", "Bearer user-token")
      .send({ ids: ["550e8400-e29b-41d4-a716-446655440000"] });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns validation errors when no ids are provided", async () => {
    const massDeleteMock = jest.mocked(BlogTagService.massDelete);
    massDeleteMock.mockRejectedValue(
      new ResponseErrorClass(400, "Validation error", {
        ids: ["Minimal satu ID harus dipilih"],
      }),
    );

    const response = await request(app)
      .delete("/admin/blog-tags/mass-delete")
      .set("Authorization", "Bearer admin-token")
      .send({ ids: [] });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.ids");
    expect(Array.isArray(response.body.errors.ids)).toBe(true);
  });
});

describe("DELETE /admin/blog-tags/mass-delete", () => {
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

  it("deletes multiple blog tag records", async () => {
    const prisma = await loadPrisma();
    const { user: admin } = await createRealUser("blog-tag-mass-delete", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);
    const first = await prisma.blogTag.create({
      data: {
        name: `Mass Tag 1 ${Date.now()}`,
        slug: `mass-tag-1-${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const second = await prisma.blogTag.create({
      data: {
        name: `Mass Tag 2 ${Date.now()}`,
        slug: `mass-tag-2-${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const response = await request(app)
      .delete("/admin/blog-tags/mass-delete")
      .set("Authorization", `Bearer ${token}`)
      .send({ ids: [first.id, second.id] });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      deleted_count: 2,
      message: "2 tag blog berhasil dihapus",
    });

    const remaining = await prisma.blogTag.findMany({
      where: { id: { in: [first.id, second.id] } },
    });
    expect(remaining).toHaveLength(0);
  });

  it("returns 403 for non-admin users", async () => {
    const { user } = await createRealUser("blog-tag-mass-delete-forbidden");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .delete("/admin/blog-tags/mass-delete")
      .set("Authorization", `Bearer ${token}`)
      .send({ ids: ["550e8400-e29b-41d4-a716-446655440000"] });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns validation errors when no ids are provided", async () => {
    const { user: admin } = await createRealUser("blog-tag-mass-delete-invalid", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .delete("/admin/blog-tags/mass-delete")
      .set("Authorization", `Bearer ${token}`)
      .send({ ids: [] });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.ids");
    expect(Array.isArray(response.body.errors.ids)).toBe(true);
  });
});
