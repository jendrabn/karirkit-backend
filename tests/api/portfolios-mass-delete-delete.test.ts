import request from "supertest";
import {
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
  loadPrisma,
} from "./real-mode";

let app: typeof import("../../src/index").default;
let PortfolioService: typeof import("../../src/services/portfolio.service").PortfolioService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/portfolio.service", () => ({
      PortfolioService: {
        massDelete: jest.fn(),
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

describe("DELETE /portfolios/mass-delete", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deletes multiple portfolio records", async () => {
    const massDeleteMock = jest.mocked(PortfolioService.massDelete);
    massDeleteMock.mockResolvedValue({
      message: "2 portfolio berhasil dihapus",
      deleted_count: 2,
    } as never);

    const response = await request(app)
      .delete("/portfolios/mass-delete")
      .set("Authorization", "Bearer user-token")
      .send({
        ids: [
          "550e8400-e29b-41d4-a716-446655440000",
          "660e8400-e29b-41d4-a716-446655440000",
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      message: "2 portfolio berhasil dihapus",
      deleted_count: 2,
    });
    expect(typeof response.body.data.deleted_count).toBe("number");
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app)
      .delete("/portfolios/mass-delete")
      .send({ ids: ["550e8400-e29b-41d4-a716-446655440000"] });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns validation errors when no ids are provided", async () => {
    const massDeleteMock = jest.mocked(PortfolioService.massDelete);
    massDeleteMock.mockRejectedValue(
      new ResponseErrorClass(400, "Validation error", {
        ids: ["Minimal satu ID harus dipilih"],
      }),
    );

    const response = await request(app)
      .delete("/portfolios/mass-delete")
      .set("Authorization", "Bearer user-token")
      .send({ ids: [] });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.ids");
    expect(Array.isArray(response.body.errors.ids)).toBe(true);
  });
});

describe("DELETE /portfolios/mass-delete", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();

  afterEach(async () => {
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("deletes multiple portfolio records", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("portfolios-mass-delete");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const first = await prisma.portfolio.create({
      data: {
        userId: user.id,
        title: "Portfolio Mass Alpha",
        slug: `portfolio-mass-alpha-${Date.now()}`,
        sortDescription: "Ringkasan alpha",
        description: "Deskripsi alpha",
        roleTitle: "Frontend Engineer",
        projectType: "work",
        industry: "Technology",
        month: 1,
        year: 2026,
        cover: "https://example.com/alpha.jpg",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const second = await prisma.portfolio.create({
      data: {
        userId: user.id,
        title: "Portfolio Mass Beta",
        slug: `portfolio-mass-beta-${Date.now()}`,
        sortDescription: "Ringkasan beta",
        description: "Deskripsi beta",
        roleTitle: "Backend Engineer",
        projectType: "personal",
        industry: "Technology",
        month: 2,
        year: 2026,
        cover: "https://example.com/beta.jpg",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const response = await request(app)
      .delete("/portfolios/mass-delete")
      .set("Authorization", `Bearer ${token}`)
      .send({ ids: [first.id, second.id] });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      message: "2 portfolio berhasil dihapus",
      deleted_count: 2,
    });

    const remaining = await prisma.portfolio.findMany({
      where: { id: { in: [first.id, second.id] } },
    });
    expect(remaining).toHaveLength(0);
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app)
      .delete("/portfolios/mass-delete")
      .send({ ids: ["550e8400-e29b-41d4-a716-446655440000"] });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns validation errors when no ids are provided", async () => {
    const { user } = await createRealUser("portfolios-mass-delete-invalid");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .delete("/portfolios/mass-delete")
      .set("Authorization", `Bearer ${token}`)
      .send({ ids: [] });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.ids");
    expect(Array.isArray(response.body.errors.ids)).toBe(true);
  });
});
