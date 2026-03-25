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
        getPortfolioDetail: jest.fn(),
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

describe("GET /u/@:username/:id", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a public portfolio detail", async () => {
    const getPortfolioDetailMock = jest.mocked(
      PublicPortfolioService.getPortfolioDetail
    );
    getPortfolioDetailMock.mockResolvedValue({
      user: { username: "johndoe" },
      portfolio: {
        id: validId,
        title: "Frontend Portfolio",
        tools: [{ id: "tool-1", name: "React" }],
      },
    } as never);

    const response = await request(app).get(`/u/@johndoe/${validId}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data.user).toMatchObject({ username: "johndoe" });
    expect(response.body.data.portfolio).toMatchObject({
      id: validId,
      title: "Frontend Portfolio",
    });
    expect(response.body.data.portfolio.tools[0]).toMatchObject({
      id: "tool-1",
      name: "React",
    });
  });

  it("returns 404 when the resource is not found", async () => {
    const getPortfolioDetailMock = jest.mocked(
      PublicPortfolioService.getPortfolioDetail
    );
    getPortfolioDetailMock.mockRejectedValue(
      new ResponseErrorClass(404, "Portfolio tidak ditemukan"),
    );

    const response = await request(app).get(`/u/@johndoe/${validId}`);

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Portfolio tidak ditemukan");
  });

  it("supports portfolio details that have empty collections", async () => {
    const getPortfolioDetailMock = jest.mocked(
      PublicPortfolioService.getPortfolioDetail
    );
    getPortfolioDetailMock.mockResolvedValue({
      user: { username: "johndoe" },
      portfolio: {
        id: validId,
        title: "Frontend Portfolio",
        tools: [],
        medias: [],
      },
    } as never);

    const response = await request(app).get(`/u/@johndoe/${validId}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.portfolio");
    expect(response.body.data.portfolio.id).toBe(validId);
    expect(response.body.data.portfolio.tools).toEqual([]);
  });
});

describe("GET /u/@:username/:id", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();

  afterEach(async () => {
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("returns a public portfolio detail", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("public-portfolio-detail");
    trackedEmails.add(user.email);
    const portfolio = await prisma.portfolio.create({
      data: {
        userId: user.id,
        title: "Frontend Portfolio",
        slug: `frontend-portfolio-detail-${Date.now()}`,
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
        tools: {
          create: [{ name: "React", createdAt: new Date(), updatedAt: new Date() }],
        },
      },
      include: {
        tools: true,
      },
    });

    const response = await request(app).get(`/u/@${user.username}/${portfolio.id}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.user");
    expect(response.body).toHaveProperty("data.portfolio");
    expect(response.body.data.user.username).toBe(user.username);
    expect(response.body.data.portfolio).toMatchObject({
      id: portfolio.id,
      title: "Frontend Portfolio",
    });
    expect(response.body.data.portfolio.tools[0].name).toBe("React");
  });

  it("returns 404 when the resource is not found", async () => {
    const { user } = await createRealUser("public-portfolio-detail-missing");
    trackedEmails.add(user.email);

    const response = await request(app).get(
      `/u/@${user.username}/550e8400-e29b-41d4-a716-446655440099`
    );

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Portfolio tidak ditemukan");
  });

  it("supports portfolio details that have empty collections", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("public-portfolio-detail-empty");
    trackedEmails.add(user.email);
    const portfolio = await prisma.portfolio.create({
      data: {
        userId: user.id,
        title: "Empty Portfolio",
        slug: `empty-portfolio-${Date.now()}`,
        sortDescription: "Ringkasan kosong",
        description: "Deskripsi kosong",
        roleTitle: "Designer",
        projectType: "personal",
        industry: "Creative",
        month: 4,
        year: 2026,
        cover: "https://example.com/empty-cover.jpg",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const response = await request(app).get(`/u/@${user.username}/${portfolio.id}`);

    expect(response.status).toBe(200);
    expect(response.body.data.portfolio.id).toBe(portfolio.id);
    expect(response.body.data.portfolio.tools).toEqual([]);
    expect(response.body.data.portfolio.medias).toEqual([]);
  });
});
