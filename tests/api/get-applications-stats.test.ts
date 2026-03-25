import request from "supertest";
import {
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
  loadPrisma,
} from "./real-mode";

let app: typeof import("../../src/index").default;
let ApplicationService: typeof import("../../src/services/application.service").ApplicationService;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/application.service", () => ({
      ApplicationService: {
        getStats: jest.fn(),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ ApplicationService } = await import("../../src/services/application.service"));
});

afterAll(async () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    await disconnectPrisma();
  }
});

describe("GET /applications/stats", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns application statistics", async () => {
    const getStatsMock = jest.mocked(ApplicationService.getStats);
    getStatsMock.mockResolvedValue({
      total_applications: 4,
      active_applications: 3,
      interview: 1,
      offer: 1,
      rejected: 1,
      needs_followup: 2,
      overdue: 1,
      no_followup: 1,
    } as never);

    const response = await request(app)
      .get("/applications/stats")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      total_applications: 4,
      active_applications: 3,
      interview: 1,
      offer: 1,
      rejected: 1,
    });
    expect(typeof response.body.data.total_applications).toBe("number");
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).get("/applications/stats");

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("supports zero-value application statistics", async () => {
    const getStatsMock = jest.mocked(ApplicationService.getStats);
    getStatsMock.mockResolvedValue({
      total_applications: 0,
      active_applications: 0,
      interview: 0,
      offer: 0,
      rejected: 0,
      needs_followup: 0,
      overdue: 0,
      no_followup: 0,
    } as never);

    const response = await request(app)
      .get("/applications/stats")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(200);
    expect(response.body.data.total_applications).toBe(0);
    expect(response.body.data.active_applications).toBe(0);
  });
});

describe("GET /applications/stats", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();

  afterEach(async () => {
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("returns application statistics", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("applications-stats");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    await prisma.application.createMany({
      data: [
        {
          userId: user.id,
          companyName: "Stat Alpha",
          position: "Backend Engineer",
          jobType: "full_time",
          workSystem: "remote",
          date: today,
          status: "submitted",
          resultStatus: "pending",
          followUpDate: null,
          createdAt: today,
          updatedAt: today,
        },
        {
          userId: user.id,
          companyName: "Stat Beta",
          position: "Frontend Engineer",
          jobType: "full_time",
          workSystem: "hybrid",
          date: today,
          status: "hr_interview",
          resultStatus: "pending",
          followUpDate: tomorrow,
          createdAt: today,
          updatedAt: today,
        },
        {
          userId: user.id,
          companyName: "Stat Gamma",
          position: "QA Engineer",
          jobType: "contract",
          workSystem: "onsite",
          date: today,
          status: "offering",
          resultStatus: "pending",
          followUpDate: yesterday,
          createdAt: today,
          updatedAt: today,
        },
        {
          userId: user.id,
          companyName: "Stat Delta",
          position: "Data Analyst",
          jobType: "internship",
          workSystem: "remote",
          date: today,
          status: "rejected",
          resultStatus: "failed",
          followUpDate: null,
          createdAt: today,
          updatedAt: today,
        },
      ],
    });

    const response = await request(app)
      .get("/applications/stats")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      total_applications: 4,
      active_applications: 3,
      interview: 1,
      offer: 1,
      rejected: 1,
      needs_followup: 2,
      no_followup: 1,
    });
    expect(typeof response.body.data.overdue).toBe("number");
    expect(response.body.data.overdue).toBeGreaterThanOrEqual(0);
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).get("/applications/stats");

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("supports zero-value application statistics", async () => {
    const { user } = await createRealUser("applications-stats-zero");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .get("/applications/stats")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.total_applications).toBe(0);
    expect(response.body.data.active_applications).toBe(0);
    expect(response.body.data.no_followup).toBe(0);
  });
});
