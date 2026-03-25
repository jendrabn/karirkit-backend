import request from "supertest";
import {
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
  loadPrisma,
} from "./real-mode";

const validId = "550e8400-e29b-41d4-a716-446655440000";

const buildApplicationData = (userId: string) => {
  const now = new Date();
  return {
    userId,
    companyName: "Duplicate Source Company",
    companyUrl: "https://duplicate-source.example.com",
    position: "Backend Engineer",
    jobSource: "LinkedIn",
    jobType: "full_time" as const,
    workSystem: "remote" as const,
    salaryMin: BigInt(10000000),
    salaryMax: BigInt(15000000),
    location: "Jakarta",
    date: now,
    status: "submitted" as const,
    resultStatus: "pending" as const,
    contactName: "HR Duplicate",
    contactEmail: "hr@duplicate-source.example.com",
    contactPhone: "081234567890",
    followUpDate: now,
    followUpNote: "Follow up duplicate",
    jobUrl: "https://duplicate-source.example.com/jobs/backend",
    notes: "Duplicate me",
    createdAt: now,
    updatedAt: now,
  };
};

let app: typeof import("../../src/index").default;
let ApplicationService: typeof import("../../src/services/application.service").ApplicationService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/application.service", () => ({
      ApplicationService: {
        duplicate: jest.fn(),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ ApplicationService } = await import("../../src/services/application.service"));
  ({ ResponseError: ResponseErrorClass } = await import(
    "../../src/utils/response-error.util"
  ));
});

afterAll(async () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    await disconnectPrisma();
  }
});

describe("POST /applications/:id/duplicate", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("duplicates the application record", async () => {
    const duplicateMock = jest.mocked(ApplicationService.duplicate);
    duplicateMock.mockResolvedValue({
      id: "660e8400-e29b-41d4-a716-446655440000",
      company_name: "Application Salinan",
    } as never);

    const response = await request(app)
      .post(`/applications/${validId}/duplicate`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: "660e8400-e29b-41d4-a716-446655440000",
      company_name: "Application Salinan",
    });
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).post(`/applications/${validId}/duplicate`);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 404 when the application cannot be duplicated", async () => {
    const duplicateMock = jest.mocked(ApplicationService.duplicate);
    duplicateMock.mockRejectedValue(
      new ResponseErrorClass(404, "Lamaran tidak ditemukan"),
    );

    const response = await request(app)
      .post(`/applications/${validId}/duplicate`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Lamaran tidak ditemukan");
  });
});

describe("POST /applications/:id/duplicate", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();

  afterEach(async () => {
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("duplicates the application record", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("applications-duplicate");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const source = await prisma.application.create({
      data: buildApplicationData(user.id),
    });

    const response = await request(app)
      .post(`/applications/${source.id}/duplicate`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      user_id: user.id,
      company_name: source.companyName,
      position: source.position,
      status: source.status,
      result_status: source.resultStatus,
    });
    expect(response.body.data.id).not.toBe(source.id);

    const duplicates = await prisma.application.findMany({
      where: { userId: user.id, companyName: source.companyName },
      orderBy: { createdAt: "asc" },
    });
    expect(duplicates.length).toBe(2);
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).post(`/applications/${validId}/duplicate`);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 404 when the application cannot be duplicated", async () => {
    const { user } = await createRealUser("applications-duplicate-missing");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .post("/applications/550e8400-e29b-41d4-a716-446655440099/duplicate")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Lamaran tidak ditemukan");
  });
});
