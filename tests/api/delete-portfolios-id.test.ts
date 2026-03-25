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
        delete: jest.fn(),
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

describe("DELETE /portfolios/:id", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deletes the portfolio resource", async () => {
    const deleteMock = jest.mocked(PortfolioService.delete);
    deleteMock.mockResolvedValue(undefined as never);

    const response = await request(app)
      .delete(`/portfolios/${validId}`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app).delete(`/portfolios/${validId}`);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 404 when the portfolio cannot be found", async () => {
    const deleteMock = jest.mocked(PortfolioService.delete);
    deleteMock.mockRejectedValue(
      new ResponseErrorClass(404, "Portfolio tidak ditemukan"),
    );

    const response = await request(app)
      .delete(`/portfolios/${validId}`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Portfolio tidak ditemukan");
  });
});

describe("DELETE /portfolios/:id", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();

  afterEach(async () => {
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("deletes the portfolio resource", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("portfolios-delete");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const portfolio = await prisma.portfolio.create({
      data: {
        userId: user.id,
        title: "Portfolio Delete",
        slug: `portfolio-delete-${Date.now()}`,
        sortDescription: "Ringkasan delete",
        description: "Deskripsi delete",
        roleTitle: "Designer",
        projectType: "personal",
        industry: "Creative",
        month: 1,
        year: 2025,
        cover: "https://example.com/delete.jpg",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const response = await request(app)
      .delete(`/portfolios/${portfolio.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(204);
    const found = await prisma.portfolio.findUnique({
      where: { id: portfolio.id },
    });
    expect(found).toBeNull();
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app).delete(`/portfolios/${validId}`);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 404 when the portfolio cannot be found", async () => {
    const { user } = await createRealUser("portfolios-delete-missing");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .delete("/portfolios/550e8400-e29b-41d4-a716-446655440099")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Portfolio tidak ditemukan");
  });
});
