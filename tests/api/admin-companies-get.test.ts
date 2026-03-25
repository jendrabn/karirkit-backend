import request from "supertest";
import {
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
  loadPrisma,
} from "./real-mode";

let app: typeof import("../../src/index").default;
let AdminCompanyService: typeof import("../../src/services/admin/company.service").AdminCompanyService;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/admin/company.service", () => ({
      AdminCompanyService: {
        list: jest.fn(),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ AdminCompanyService } = await import(
    "../../src/services/admin/company.service"
  ));
});

afterAll(async () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    await disconnectPrisma();
  }
});

describe("GET /admin/companies", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns admin company listings", async () => {
    const listMock = jest.mocked(AdminCompanyService.list);
    listMock.mockResolvedValue({
      items: [{ id: "company-1", name: "Acme" }],
      meta: { page: 1, per_page: 20, total: 1 },
    } as never);

    const response = await request(app)
      .get("/admin/companies")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body.data.items[0]).toMatchObject({
      id: "company-1",
      name: "Acme",
    });
  });

  it("returns 403 for non-admin users", async () => {
    const response = await request(app)
      .get("/admin/companies")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the company range query is invalid", async () => {
    const response = await request(app)
      .get("/admin/companies?job_count_from=10&job_count_to=5")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.job_count_from");
    expect(Array.isArray(response.body.errors.job_count_from)).toBe(true);
  });
});

describe("GET /admin/companies", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();
  const trackedCompanyIds = new Set<string>();

  afterEach(async () => {
    const prisma = await loadPrisma();
    if (trackedCompanyIds.size > 0) {
      await prisma.company.deleteMany({
        where: {
          id: { in: [...trackedCompanyIds] },
        },
      });
    }
    trackedCompanyIds.clear();
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("returns admin company listings", async () => {
    const prisma = await loadPrisma();
    const { user: admin } = await createRealUser("admin-companies-list", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);

    const first = await prisma.company.create({
      data: {
        name: "Acme Real",
        slug: "acme-real-list",
        employeeSize: "eleven_to_fifty",
        businessSector: "Technology",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const second = await prisma.company.create({
      data: {
        name: "Beta Real",
        slug: "beta-real-list",
        employeeSize: "one_to_ten",
        businessSector: "Consulting",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedCompanyIds.add(first.id);
    trackedCompanyIds.add(second.id);

    const response = await request(app)
      .get("/admin/companies?sort_by=name&sort_order=asc")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body).toHaveProperty("data.pagination");
    expect(response.body.data.items.length).toBeGreaterThanOrEqual(2);
    expect(response.body.data.items[0]).toHaveProperty("name");
    expect(response.body.data.pagination.total_items).toBeGreaterThanOrEqual(2);
  });

  it("returns 403 for non-admin users", async () => {
    const { user } = await createRealUser("admin-companies-list-forbidden");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .get("/admin/companies")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the company range query is invalid", async () => {
    const { user: admin } = await createRealUser("admin-companies-list-invalid", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .get("/admin/companies?job_count_from=10&job_count_to=5")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.job_count_from");
    expect(Array.isArray(response.body.errors.job_count_from)).toBe(true);
  });
});
