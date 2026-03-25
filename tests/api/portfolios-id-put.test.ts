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
        update: jest.fn(),
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

describe("PUT /portfolios/:id", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("updates a portfolio record", async () => {
    const updateMock = jest.mocked(PortfolioService.update);
    updateMock.mockResolvedValue({
      id: validId,
      title: "Portfolio Diperbarui",
    } as never);

    const response = await request(app)
      .put(`/portfolios/${validId}`)
      .set("Authorization", "Bearer user-token")
      .send({ title: "Portfolio Diperbarui" });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: validId,
      title: "Portfolio Diperbarui",
    });
    expect(typeof response.body.data.title).toBe("string");
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app)
      .put(`/portfolios/${validId}`)
      .send({ title: "Portfolio Diperbarui" });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns validation errors for invalid updates", async () => {
    const updateMock = jest.mocked(PortfolioService.update);
    updateMock.mockRejectedValue(
      new ResponseErrorClass(400, "Validation error", {
        title: ["Judul wajib diisi"],
      }),
    );

    const response = await request(app)
      .put(`/portfolios/${validId}`)
      .set("Authorization", "Bearer user-token")
      .send({ title: "" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.title");
    expect(Array.isArray(response.body.errors.title)).toBe(true);
  });
});

describe("PUT /portfolios/:id", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();

  afterEach(async () => {
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("updates a portfolio record", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("portfolios-update");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const portfolio = await prisma.portfolio.create({
      data: {
        userId: user.id,
        title: "Portfolio Lama",
        slug: `portfolio-lama-${Date.now()}`,
        sortDescription: "Ringkasan lama",
        description: "Deskripsi lama",
        roleTitle: "Designer",
        projectType: "personal",
        industry: "Creative",
        month: 1,
        year: 2025,
        cover: "https://example.com/old.jpg",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const response = await request(app)
      .put(`/portfolios/${portfolio.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Portfolio Diperbarui",
        sort_description: "Ringkasan baru",
        description: "Deskripsi baru",
        role_title: "Product Designer",
        project_type: "work",
        industry: "Technology",
        month: 4,
        year: 2026,
        cover: "https://example.com/new.jpg",
        tools: ["Figma", "Notion"],
        medias: [{ path: "https://example.com/media.jpg", caption: "Mockup" }],
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: portfolio.id,
      title: "Portfolio Diperbarui",
      role_title: "Product Designer",
      industry: "Technology",
    });
    expect(response.body.data.tools).toHaveLength(2);

    const stored = await prisma.portfolio.findUnique({
      where: { id: portfolio.id },
    });
    expect(stored?.title).toBe("Portfolio Diperbarui");
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app)
      .put(`/portfolios/${validId}`)
      .send({ title: "Portfolio Diperbarui" });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns validation errors for invalid updates", async () => {
    const { user } = await createRealUser("portfolios-update-invalid");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const prisma = await loadPrisma();
    const portfolio = await prisma.portfolio.create({
      data: {
        userId: user.id,
        title: "Portfolio Invalid",
        slug: `portfolio-invalid-${Date.now()}`,
        sortDescription: "Ringkasan invalid",
        description: "Deskripsi invalid",
        roleTitle: "Designer",
        projectType: "personal",
        industry: "Creative",
        month: 1,
        year: 2025,
        cover: "https://example.com/invalid.jpg",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const response = await request(app)
      .put(`/portfolios/${portfolio.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.title");
    expect(Array.isArray(response.body.errors.title)).toBe(true);
  });
});
