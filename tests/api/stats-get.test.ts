import request from "supertest";
import {
  createRealUser,
  deleteUsersByEmail,
  disconnectPrisma,
  loadPrisma,
} from "./real-mode";

let app: typeof import("../../src/index").default;
let prismaMock: typeof import("../../src/config/prisma.config").prisma;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/config/prisma.config", () => ({
      prisma: {
        user: { count: jest.fn() },
        cv: { count: jest.fn() },
        applicationLetter: { count: jest.fn() },
        application: { count: jest.fn() },
        template: { count: jest.fn() },
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ prisma: prismaMock } = await import("../../src/config/prisma.config"));
});

afterAll(async () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    await disconnectPrisma();
  }
});

describe("GET /stats", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  const getPrisma = () =>
    prismaMock as unknown as {
      user: { count: jest.Mock };
      cv: { count: jest.Mock };
      applicationLetter: { count: jest.Mock };
      application: { count: jest.Mock };
      template: { count: jest.Mock };
    };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns aggregated public statistics", async () => {
    const prisma = getPrisma();
    prisma.user.count.mockResolvedValue(10);
    prisma.cv.count.mockResolvedValue(7);
    prisma.applicationLetter.count.mockResolvedValue(4);
    prisma.application.count.mockResolvedValue(12);
    prisma.template.count.mockResolvedValueOnce(3).mockResolvedValueOnce(2);

    const response = await request(app).get("/stats");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      total_users: 10,
      total_cvs: 7,
      total_application_letters: 4,
      total_applications: 12,
      total_cv_templates: 3,
      total_application_letter_templates: 2,
    });
    expect(typeof response.body.data.total_users).toBe("number");
  });

  it("returns 500 when one of the counters fails", async () => {
    const prisma = getPrisma();
    prisma.user.count.mockRejectedValue(new Error("Database unavailable"));

    const response = await request(app).get("/stats");

    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Database unavailable");
  });

  it("supports zero-value counters", async () => {
    const prisma = getPrisma();
    prisma.user.count.mockResolvedValue(0);
    prisma.cv.count.mockResolvedValue(0);
    prisma.applicationLetter.count.mockResolvedValue(0);
    prisma.application.count.mockResolvedValue(0);
    prisma.template.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

    const response = await request(app).get("/stats");

    expect(response.status).toBe(200);
    expect(response.body.data.total_users).toBe(0);
    expect(response.body.data.total_cv_templates).toBe(0);
  });
});

describe("GET /stats", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();

  afterEach(async () => {
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("returns aggregated public statistics", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("stats-public");
    trackedEmails.add(user.email);

    const response = await request(app).get("/stats");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      total_users: await prisma.user.count({ where: { role: "user" } }),
      total_cvs: await prisma.cv.count(),
      total_application_letters: await prisma.applicationLetter.count(),
      total_applications: await prisma.application.count(),
      total_cv_templates: await prisma.template.count({
        where: { type: "cv" },
      }),
      total_application_letter_templates: await prisma.template.count({
        where: { type: "application_letter" },
      }),
    });
  });

  it("returns 500 when the stats query fails unexpectedly", async () => {
    const prisma = await loadPrisma();
    const spy = jest
      .spyOn(prisma.user, "count")
      .mockRejectedValueOnce(new Error("Database unavailable"));

    const response = await request(app).get("/stats");

    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Database unavailable");

    spy.mockRestore();
  });

  it("supports zero-value counters", async () => {
    const response = await request(app).get("/stats");

    expect(response.status).toBe(200);
    expect(typeof response.body.data.total_users).toBe("number");
    expect(typeof response.body.data.total_cv_templates).toBe("number");
  });
});
