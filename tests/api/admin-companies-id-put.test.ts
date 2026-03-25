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
let AdminCompanyService: typeof import("../../src/services/admin/company.service").AdminCompanyService;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/admin/company.service", () => ({
      AdminCompanyService: {
        update: jest.fn(),
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

describe("PUT /admin/companies/:id", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("updates a company for admin users", async () => {
    const updateMock = jest.mocked(AdminCompanyService.update);
    updateMock.mockResolvedValue({
      id: validId,
      name: "Updated Company",
    } as never);

    const response = await request(app)
      .put(`/admin/companies/${validId}`)
      .set("Authorization", "Bearer admin-token")
      .send({
        name: "Updated Company",
        website_url: "https://example.com",
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: validId,
      name: "Updated Company",
    });
  });

  it("returns 403 for non-admin users", async () => {
    const response = await request(app)
      .put(`/admin/companies/${validId}`)
      .set("Authorization", "Bearer user-token")
      .send({});

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the update payload is invalid", async () => {
    const response = await request(app)
      .put(`/admin/companies/${validId}`)
      .set("Authorization", "Bearer admin-token")
      .send({
        website_url: "not-a-url",
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.website_url");
    expect(Array.isArray(response.body.errors.website_url)).toBe(true);
  });
});

describe("PUT /admin/companies/:id", () => {
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

  it("updates a company for admin users", async () => {
    const prisma = await loadPrisma();
    const { user: admin } = await createRealUser("admin-companies-update", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);
    const company = await prisma.company.create({
      data: {
        name: "Old Company Real",
        slug: "old-company-real",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedCompanyIds.add(company.id);

    const response = await request(app)
      .put(`/admin/companies/${company.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Updated Company Real",
        website_url: "https://updated-real.com",
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: company.id,
      name: "Updated Company Real",
      slug: "updated-company-real",
      website_url: "https://updated-real.com",
    });
  });

  it("returns 403 for non-admin users", async () => {
    const { user } = await createRealUser("admin-companies-update-forbidden");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .put(`/admin/companies/${validId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the update payload is invalid", async () => {
    const { user: admin } = await createRealUser("admin-companies-update-invalid", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .put(`/admin/companies/${validId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        website_url: "not-a-url",
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.website_url");
    expect(Array.isArray(response.body.errors.website_url)).toBe(true);
  });
});
