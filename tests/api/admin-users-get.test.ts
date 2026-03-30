import request from "supertest";
import {
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
} from "./real-mode";

let app: typeof import("../../src/index").default;
let UserService: typeof import("../../src/services/admin/user.service").UserService;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/admin/user.service", () => ({
      UserService: {
        list: jest.fn(),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ UserService } = await import("../../src/services/admin/user.service"));
});

afterAll(async () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    await disconnectPrisma();
  }
});

describe("GET /admin/users", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a paginated user list", async () => {
    const listMock = jest.mocked(UserService.list);
    listMock.mockResolvedValue({
      items: [{ id: "550e8400-e29b-41d4-a716-446655440000", name: "User 1" }],
      pagination: { page: 1, per_page: 20, total_items: 1, total_pages: 1 },
    } as never);

    const response = await request(app)
      .get("/admin/users")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body).toHaveProperty("data.pagination");
    expect(Array.isArray(response.body.data.items)).toBe(true);
    expect(response.body.data.items[0]).toMatchObject({
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "User 1",
    });
    expect(typeof response.body.data.pagination.total_items).toBe("number");
  });

  it("returns 403 when a non-admin user accesses the endpoint", async () => {
    const response = await request(app)
      .get("/admin/users")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("supports an empty user state", async () => {
    const listMock = jest.mocked(UserService.list);
    listMock.mockResolvedValue({
      items: [],
      pagination: { page: 1, per_page: 20, total_items: 0, total_pages: 0 },
    } as never);

    const response = await request(app)
      .get("/admin/users")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body.data.items).toEqual([]);
    expect(response.body.data.pagination.total_items).toBe(0);
  });
});

describe("GET /admin/users", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();

  afterEach(async () => {
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("returns a paginated user list", async () => {
    const suffix = `${Date.now()}`;
    const { user: admin } = await createRealUser("admin-users-list-admin", {
      role: "admin",
    });
    const { user: first } = await createRealUser("admin-users-list-first", {
      name: `Admin Users Filter ${suffix} Alpha`,
      username: `admin-users-filter-${suffix}-a`,
      email: `admin-users-filter-${suffix}-a@example.com`,
    });
    const { user: second } = await createRealUser("admin-users-list-second", {
      name: `Admin Users Filter ${suffix} Beta`,
      username: `admin-users-filter-${suffix}-b`,
      email: `admin-users-filter-${suffix}-b@example.com`,
    });
    trackedEmails.add(admin.email);
    trackedEmails.add(first.email);
    trackedEmails.add(second.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .get(`/admin/users?q=admin-users-filter-${suffix}&sort_by=name&sort_order=asc`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body).toHaveProperty("data.pagination");
    expect(Array.isArray(response.body.data.items)).toBe(true);
    expect(response.body.data.items).toHaveLength(2);
    expect(response.body.data.items[0]).toHaveProperty("id");
    expect(response.body.data.items[0]).toHaveProperty("last_login_at");
    expect(response.body.data.items[0].subscription_plan).toBe("free");
    expect(response.body.data.items[0].subscription_expires_at).toBeNull();
    expect(typeof response.body.data.items[0].download_total_count).toBe("number");
    expect(typeof response.body.data.items[0].download_today_count).toBe("number");
    expect(response.body.data.items[0]).not.toHaveProperty("download_stats");
    expect(response.body.data.items[0]).not.toHaveProperty("daily_download_limit");
    expect(response.body.data.items[0]).not.toHaveProperty("document_storage_limit");
    expect(response.body.data.items[0]).not.toHaveProperty("document_storage_stats");
    expect(response.body.data.pagination).toMatchObject({
      page: 1,
      total_items: 2,
      total_pages: 1,
    });
  });

  it("returns 403 when a non-admin user accesses the endpoint", async () => {
    const { user } = await createRealUser("admin-users-list-forbidden");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .get("/admin/users")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the date range query is invalid", async () => {
    const { user: admin } = await createRealUser("admin-users-list-invalid", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .get("/admin/users?created_at_from=2025-12-31&created_at_to=2025-01-01")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.created_at_from");
    expect(Array.isArray(response.body.errors.created_at_from)).toBe(true);
  });
});
