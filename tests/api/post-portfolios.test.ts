import request from "supertest";
import {
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
  loadPrisma,
} from "./real-mode";

const buildPortfolioPayload = (suffix: string) => ({
  title: `Portfolio ${suffix}`,
  sort_description: "Ringkasan portfolio",
  description: "Deskripsi portfolio yang lengkap untuk pengujian.",
  role_title: "Frontend Engineer",
  project_type: "work",
  industry: "Technology",
  month: 3,
  year: 2026,
  live_url: "https://example.com/live",
  repo_url: "https://github.com/example/repo",
  cover: "https://example.com/cover.jpg",
  tools: ["React", "TypeScript"],
  medias: [
    {
      path: "https://example.com/media-1.jpg",
      caption: "Landing page",
    },
  ],
});

let app: typeof import("../../src/index").default;
let PortfolioService: typeof import("../../src/services/portfolio.service").PortfolioService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/portfolio.service", () => ({
      PortfolioService: {
        create: jest.fn(),
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

describe("POST /portfolios", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a portfolio record", async () => {
    const createMock = jest.mocked(PortfolioService.create);
    createMock.mockResolvedValue({
      id: "550e8400-e29b-41d4-a716-446655440000",
      title: "Portfolio Baru",
    } as never);

    const response = await request(app)
      .post("/portfolios")
      .set("Authorization", "Bearer user-token")
      .send({ title: "Portfolio Baru" });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: "550e8400-e29b-41d4-a716-446655440000",
      title: "Portfolio Baru",
    });
    expect(typeof response.body.data.id).toBe("string");
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app)
      .post("/portfolios")
      .send({ title: "Portfolio Baru" });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns validation errors for invalid payloads", async () => {
    const createMock = jest.mocked(PortfolioService.create);
    createMock.mockRejectedValue(
      new ResponseErrorClass(400, "Validation error", {
        title: ["Judul wajib diisi"],
      }),
    );

    const response = await request(app)
      .post("/portfolios")
      .set("Authorization", "Bearer user-token")
      .send({ title: "" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.title");
    expect(Array.isArray(response.body.errors.title)).toBe(true);
  });
});

describe("POST /portfolios", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();

  afterEach(async () => {
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("creates a portfolio record", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("portfolios-create");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const payload = buildPortfolioPayload(`${Date.now()}`);

    const response = await request(app)
      .post("/portfolios")
      .set("Authorization", `Bearer ${token}`)
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      user_id: user.id,
      title: payload.title,
      role_title: payload.role_title,
      project_type: payload.project_type,
      industry: payload.industry,
    });
    expect(response.body.data.tools).toHaveLength(2);
    expect(response.body.data.medias).toHaveLength(1);

    const stored = await prisma.portfolio.findUnique({
      where: { id: response.body.data.id },
    });
    expect(stored).not.toBeNull();
    expect(stored?.title).toBe(payload.title);
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app).post("/portfolios").send(
      buildPortfolioPayload("unauth"),
    );

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns validation errors for invalid payloads", async () => {
    const { user } = await createRealUser("portfolios-create-invalid");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .post("/portfolios")
      .set("Authorization", `Bearer ${token}`)
      .send({
        ...buildPortfolioPayload("invalid"),
        title: "",
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.title");
    expect(Array.isArray(response.body.errors.title)).toBe(true);
  });
});
