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
        create: jest.fn(),
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

describe("POST /admin/companies", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a company for admin users", async () => {
    const createMock = jest.mocked(AdminCompanyService.create);
    createMock.mockResolvedValue({
      id: "company-1",
      name: "PT Example",
    } as never);

    const response = await request(app)
      .post("/admin/companies")
      .set("Authorization", "Bearer admin-token")
      .send({
        name: "PT Example",
        description: "Technology company",
        website_url: "https://example.com",
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: "company-1",
      name: "PT Example",
    });
  });

  it("returns 403 for non-admin users", async () => {
    const response = await request(app)
      .post("/admin/companies")
      .set("Authorization", "Bearer user-token")
      .send({});

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the company payload is invalid", async () => {
    const response = await request(app)
      .post("/admin/companies")
      .set("Authorization", "Bearer admin-token")
      .send({
        name: "AB",
        website_url: "not-a-url",
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.name");
    expect(Array.isArray(response.body.errors.name)).toBe(true);
  });
});

describe("POST /admin/companies", () => {
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

  it("creates a company for admin users", async () => {
    const prisma = await loadPrisma();
    const { user: admin } = await createRealUser("admin-companies-create", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .post("/admin/companies")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "PT Example Real",
        description: "Technology company",
        website_url: "https://example-real.com",
        employee_size: "eleven_to_fifty",
        business_sector: "Technology",
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      name: "PT Example Real",
      slug: "pt-example-real",
      website_url: "https://example-real.com",
      employee_size: "eleven_to_fifty",
      business_sector: "Technology",
      job_count: 0,
    });
    trackedCompanyIds.add(response.body.data.id);

    const saved = await prisma.company.findUnique({
      where: { id: response.body.data.id },
    });
    expect(saved?.slug).toBe("pt-example-real");
  });

  it("returns 403 for non-admin users", async () => {
    const { user } = await createRealUser("admin-companies-create-forbidden");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .post("/admin/companies")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the company payload is invalid", async () => {
    const { user: admin } = await createRealUser("admin-companies-create-invalid", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .post("/admin/companies")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "AB",
        website_url: "not-a-url",
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.name");
    expect(Array.isArray(response.body.errors.name)).toBe(true);
  });
});
