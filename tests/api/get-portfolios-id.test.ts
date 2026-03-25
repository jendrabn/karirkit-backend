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
let PortfolioService: typeof import("../../src/services/portfolio.service").PortfolioService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/portfolio.service", () => ({
      PortfolioService: {
        get: jest.fn(),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ PortfolioService } = await import("../../src/services/portfolio.service"));
  ({ ResponseError: ResponseErrorClass } = await import(
    "../../src/utils/response-error.util"
  ));
});

afterAll(async () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    await disconnectPrisma();
  }
});

describe("GET /portfolios/:id", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns portfolio details", async () => {
    const getMock = jest.mocked(PortfolioService.get);
    getMock.mockResolvedValue({
      id: validId,
      title: "Portfolio Detail",
      tools: [],
    } as never);

    const response = await request(app)
      .get(`/portfolios/${validId}`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: validId,
      title: "Portfolio Detail",
    });
    expect(typeof response.body.data.id).toBe("string");
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app).get(`/portfolios/${validId}`);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 404 when the portfolio does not exist", async () => {
    const getMock = jest.mocked(PortfolioService.get);
    getMock.mockRejectedValue(
      new ResponseErrorClass(404, "Portfolio tidak ditemukan"),
    );

    const response = await request(app)
      .get(`/portfolios/${validId}`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Portfolio tidak ditemukan");
  });
});

describe("GET /portfolios/:id", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();

  afterEach(async () => {
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("returns portfolio details", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("portfolios-get");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const portfolio = await prisma.portfolio.create({
      data: {
        userId: user.id,
        title: "Portfolio Detail",
        slug: `portfolio-detail-${Date.now()}`,
        sortDescription: "Ringkasan detail",
        description: "Deskripsi detail",
        roleTitle: "Product Designer",
        projectType: "work",
        industry: "Creative",
        month: 3,
        year: 2026,
        cover: "https://example.com/detail.jpg",
        createdAt: new Date(),
        updatedAt: new Date(),
        tools: {
          create: [{ name: "Figma", createdAt: new Date(), updatedAt: new Date() }],
        },
      },
    });

    const response = await request(app)
      .get(`/portfolios/${portfolio.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: portfolio.id,
      title: "Portfolio Detail",
      role_title: "Product Designer",
    });
    expect(response.body.data.tools[0].name).toBe("Figma");
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app).get(`/portfolios/${validId}`);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 404 when the portfolio does not exist", async () => {
    const { user } = await createRealUser("portfolios-get-missing");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .get("/portfolios/550e8400-e29b-41d4-a716-446655440099")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Portfolio tidak ditemukan");
  });
});
