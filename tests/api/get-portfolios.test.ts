import request from "supertest";
import {
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
} from "./real-mode";

let app: typeof import("../../src/index").default;
let PortfolioService: typeof import("../../src/services/portfolio.service").PortfolioService;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/portfolio.service", () => ({
      PortfolioService: {
        list: jest.fn(),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ PortfolioService } = await import("../../src/services/portfolio.service"));
});

afterAll(async () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    await disconnectPrisma();
  }
});

describe("GET /portfolios", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a paginated portfolio list", async () => {
    const listMock = jest.mocked(PortfolioService.list);
    listMock.mockResolvedValue({
      items: [{ id: "550e8400-e29b-41d4-a716-446655440000", title: "Portfolio 1" }],
      pagination: { page: 1, per_page: 20, total_items: 1, total_pages: 1 },
    } as never);

    const response = await request(app)
      .get("/portfolios")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body).toHaveProperty("data.pagination");
    expect(Array.isArray(response.body.data.items)).toBe(true);
    expect(response.body.data.items[0]).toMatchObject({
      id: "550e8400-e29b-41d4-a716-446655440000",
      title: "Portfolio 1",
    });
    expect(typeof response.body.data.pagination.total_items).toBe("number");
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).get("/portfolios");

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("supports an empty portfolio state", async () => {
    const listMock = jest.mocked(PortfolioService.list);
    listMock.mockResolvedValue({
      items: [],
      pagination: { page: 1, per_page: 20, total_items: 0, total_pages: 0 },
    } as never);

    const response = await request(app)
      .get("/portfolios")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body.data.items).toEqual([]);
    expect(response.body.data.pagination.total_items).toBe(0);
  });
});

describe("GET /portfolios", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();

  afterEach(async () => {
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("returns a paginated portfolio list", async () => {
    const prisma = await import("../../src/config/prisma.config").then(
      (module) => module.prisma
    );
    const { user } = await createRealUser("portfolios-list");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const suffix = Date.now();

    await prisma.portfolio.createMany({
      data: [
        {
          userId: user.id,
          title: `Portfolio ${suffix} Alpha`,
          slug: `portfolio-${suffix}-alpha`,
          sortDescription: "Ringkasan alpha",
          description: "Deskripsi alpha",
          roleTitle: "Frontend Engineer",
          projectType: "work",
          industry: "Technology",
          month: 3,
          year: 2026,
          cover: "https://example.com/alpha.jpg",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          userId: user.id,
          title: `Portfolio ${suffix} Beta`,
          slug: `portfolio-${suffix}-beta`,
          sortDescription: "Ringkasan beta",
          description: "Deskripsi beta",
          roleTitle: "Backend Engineer",
          projectType: "personal",
          industry: "Technology",
          month: 4,
          year: 2026,
          cover: "https://example.com/beta.jpg",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });

    const response = await request(app)
      .get(`/portfolios?q=${suffix}&sort_by=title&sort_order=asc`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body).toHaveProperty("data.pagination");
    expect(response.body.data.items).toHaveLength(2);
    expect(response.body.data.items[0]).toHaveProperty("title");
    expect(response.body.data.pagination.total_items).toBe(2);
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).get("/portfolios");

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("supports an empty portfolio state", async () => {
    const { user } = await createRealUser("portfolios-empty");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .get("/portfolios")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.items).toEqual([]);
    expect(response.body.data.pagination.total_items).toBe(0);
  });
});
