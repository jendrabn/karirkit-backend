import request from "supertest";
import {
  createRealUser,
  deleteUsersByEmail,
  disconnectPrisma,
  loadPrisma,
} from "./real-mode";

const validId = "550e8400-e29b-41d4-a716-446655440000";
let app: typeof import("../../src/index").default;
let PublicPortfolioService: typeof import("../../src/services/public-portfolio.service").PublicPortfolioService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/public-portfolio.service", () => ({
      PublicPortfolioService: {
        listByUsername: jest.fn(),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ PublicPortfolioService } = await import(
    "../../src/services/public-portfolio.service"
  ));
  ({ ResponseError: ResponseErrorClass } = await import(
    "../../src/utils/response-error.util"
  ));
});

afterAll(async () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    await disconnectPrisma();
  }
});

describe("GET /u/@:username", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a public portfolio listing for the username", async () => {
    const listByUsernameMock = jest.mocked(PublicPortfolioService.listByUsername);
    listByUsernameMock.mockResolvedValue({
      user: { username: "johndoe" },
      portfolios: [{ id: validId, title: "Frontend Portfolio" }],
    } as never);

    const response = await request(app).get("/u/@johndoe");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      user: { username: "johndoe" },
    });
    expect(response.body.data.portfolios[0]).toMatchObject({
      id: validId,
      title: "Frontend Portfolio",
    });
    expect(typeof response.body.data.portfolios[0].id).toBe("string");
  });

  it("returns 404 when the user is not found", async () => {
    const listByUsernameMock = jest.mocked(PublicPortfolioService.listByUsername);
    listByUsernameMock.mockRejectedValue(
      new ResponseErrorClass(404, "Pengguna tidak ditemukan"),
    );

    const response = await request(app).get("/u/@johndoe");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Pengguna tidak ditemukan");
  });

  it("supports users who have no public portfolio items yet", async () => {
    const listByUsernameMock = jest.mocked(PublicPortfolioService.listByUsername);
    listByUsernameMock.mockResolvedValue({
      user: { username: "johndoe" },
      portfolios: [],
    } as never);

    const response = await request(app).get("/u/@johndoe");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.portfolios");
    expect(response.body.data.user.username).toBe("johndoe");
    expect(response.body.data.portfolios).toEqual([]);
  });
});

describe("GET /u/@:username", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();

  afterEach(async () => {
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("returns a public portfolio listing for the username", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("public-portfolio-list");
    trackedEmails.add(user.email);
    await prisma.portfolio.create({
      data: {
        userId: user.id,
        title: "Frontend Portfolio",
        slug: `frontend-portfolio-${Date.now()}`,
        sortDescription: "Ringkasan frontend",
        description: "Deskripsi frontend",
        roleTitle: "Frontend Engineer",
        projectType: "work",
        industry: "Technology",
        month: 3,
        year: 2026,
        cover: "https://example.com/portfolio-cover.jpg",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const response = await request(app).get(`/u/@${user.username}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.user");
    expect(response.body).toHaveProperty("data.portfolios");
    expect(response.body.data.user.username).toBe(user.username);
    expect(Array.isArray(response.body.data.portfolios)).toBe(true);
    expect(response.body.data.portfolios[0]).toHaveProperty("title");
  });

  it("returns 404 when the user is not found", async () => {
    const response = await request(app).get("/u/@missing-public-user");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Pengguna tidak ditemukan");
  });

  it("supports users who have no public portfolio items yet", async () => {
    const { user } = await createRealUser("public-portfolio-empty");
    trackedEmails.add(user.email);

    const response = await request(app).get(`/u/@${user.username}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.portfolios");
    expect(response.body.data.user.username).toBe(user.username);
    expect(response.body.data.portfolios).toEqual([]);
  });
});
