import request from "supertest";
import {
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
  loadPrisma,
} from "./real-mode";

let app: typeof import("../../src/index").default;
let DashboardService: typeof import("../../src/services/admin/dashboard.service").DashboardService;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/admin/dashboard.service", () => ({
      DashboardService: {
        getStats: jest.fn(),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ DashboardService } = await import(
    "../../src/services/admin/dashboard.service"
  ));
});

afterAll(async () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    await disconnectPrisma();
  }
});

describe("GET /admin/dashboard", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns dashboard statistics for admin users", async () => {
    const getStatsMock = jest.mocked(DashboardService.getStats);
    getStatsMock.mockResolvedValue({
      total_accounts: 14,
      total_users: 12,
      total_admins: 2,
      total_jobs: 5,
      total_subscriptions: 3,
    } as never);

    const response = await request(app)
      .get("/admin/dashboard")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      total_accounts: 14,
      total_users: 12,
      total_jobs: 5,
      total_subscriptions: 3,
    });
  });

  it("returns 403 for non-admin users", async () => {
    const response = await request(app)
      .get("/admin/dashboard")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 401 when no session is provided", async () => {
    const response = await request(app).get("/admin/dashboard");

    expect(response.status).toBe(401);
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });
});

describe("GET /admin/dashboard", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();
  const trackedBlogIds = new Set<string>();
  const trackedCategoryIds = new Set<string>();
  const trackedTagIds = new Set<string>();
  const trackedTemplateIds = new Set<string>();

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
    if (trackedTemplateIds.size > 0) {
      await prisma.template.deleteMany({
        where: { id: { in: [...trackedTemplateIds] } },
      });
    }
    trackedBlogIds.clear();
    trackedCategoryIds.clear();
    trackedTagIds.clear();
    trackedTemplateIds.clear();
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("returns dashboard statistics for admin users", async () => {
    const prisma = await loadPrisma();
    const { user: admin } = await createRealUser("admin-dashboard-admin", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);
    const { user: normalUser } = await createRealUser("admin-dashboard-user");
    trackedEmails.add(normalUser.email);

    const category = await prisma.blogCategory.create({
      data: {
        name: `Dash Category ${Date.now()}`,
        slug: `dash-category-${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedCategoryIds.add(category.id);

    const tag = await prisma.blogTag.create({
      data: {
        name: `Dash Tag ${Date.now()}`,
        slug: `dash-tag-${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedTagIds.add(tag.id);

    const blog = await prisma.blog.create({
      data: {
        userId: admin.id,
        categoryId: category.id,
        title: `Dash Blog ${Date.now()}`,
        slug: `dash-blog-${Date.now()}`,
        content: "Konten dashboard blog.",
        status: "published",
        readTime: 2,
        views: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
        publishedAt: new Date(),
        tags: { create: [{ tagId: tag.id }] },
      },
    });
    trackedBlogIds.add(blog.id);

    const template = await prisma.template.create({
      data: {
        name: `Dash Template ${Date.now()}`,
        type: "cv",
        path: `/uploads/templates/dash-template-${Date.now()}.docx`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedTemplateIds.add(template.id);

    const response = await request(app)
      .get("/admin/dashboard")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data.total_accounts).toBe(await prisma.user.count());
    expect(response.body.data.total_users).toBe(
      await prisma.user.count({ where: { role: "user" } }),
    );
    expect(response.body.data.total_admins).toBe(
      await prisma.user.count({ where: { role: "admin" } }),
    );
    expect(response.body.data.total_blogs).toBe(await prisma.blog.count());
    expect(response.body.data.total_templates).toBe(await prisma.template.count());
    expect(response.body.data.total_jobs).toBe(await prisma.job.count());
    expect(response.body.data.total_companies).toBe(await prisma.company.count());
    expect(response.body.data.total_job_roles).toBe(await prisma.jobRole.count());
    expect(response.body.data.total_subscriptions).toBe(
      await prisma.subscription.count(),
    );
    expect(typeof response.body.data.total_subscription_revenue).toBe("number");
    expect(response.body.data).toHaveProperty("user_status_distribution");
    expect(response.body.data).toHaveProperty("job_status_distribution");
    expect(response.body.data).toHaveProperty(
      "subscription_status_distribution",
    );
    expect(Array.isArray(response.body.data.recent_users)).toBe(true);
    expect(Array.isArray(response.body.data.recent_blogs)).toBe(true);
  });

  it("returns 403 for non-admin users", async () => {
    const { user } = await createRealUser("admin-dashboard-forbidden");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .get("/admin/dashboard")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 401 when no session is provided", async () => {
    const response = await request(app).get("/admin/dashboard");

    expect(response.status).toBe(401);
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });
});
