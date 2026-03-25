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
let ApplicationService: typeof import("../../src/services/application.service").ApplicationService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/application.service", () => ({
      ApplicationService: {
        delete: jest.fn(),
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

describe("DELETE /applications/:id", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deletes the application resource", async () => {
    const deleteMock = jest.mocked(ApplicationService.delete);
    deleteMock.mockResolvedValue(undefined as never);

    const response = await request(app)
      .delete(`/applications/${validId}`).set("Authorization", "Bearer user-token");

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app)
      .delete(`/applications/${validId}`);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 404 when the application cannot be found", async () => {
    const deleteMock = jest.mocked(ApplicationService.delete);
    deleteMock.mockRejectedValue(
      new ResponseErrorClass(404, "Application tidak ditemukan"),
    );

    const response = await request(app)
      .delete(`/applications/${validId}`).set("Authorization", "Bearer user-token");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Application tidak ditemukan");
  });
});

describe("DELETE /applications/:id", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();

  afterEach(async () => {
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("deletes the application resource from the database", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("applications-delete");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const application = await prisma.application.create({
      data: {
        userId: user.id,
        companyName: "PT Delete",
        position: "DevOps Engineer",
        jobType: "full_time",
        workSystem: "hybrid",
        date: new Date("2026-03-24T00:00:00.000Z"),
        status: "submitted",
        resultStatus: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const response = await request(app)
      .delete(`/applications/${application.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(204);
    expect(response.text).toBe("");

    const deleted = await prisma.application.findUnique({
      where: { id: application.id },
    });
    expect(deleted).toBeNull();
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app).delete(`/applications/${validId}`);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 404 when the application belongs to another user", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("applications-delete-owner");
    const { user: otherUser } = await createRealUser("applications-delete-other");
    trackedEmails.add(user.email);
    trackedEmails.add(otherUser.email);
    const token = await createSessionToken(user);
    const application = await prisma.application.create({
      data: {
        userId: otherUser.id,
        companyName: "PT Hidden",
        position: "Security Engineer",
        jobType: "full_time",
        workSystem: "onsite",
        date: new Date("2026-03-24T00:00:00.000Z"),
        status: "submitted",
        resultStatus: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const response = await request(app)
      .delete(`/applications/${application.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Lamaran tidak ditemukan");
  });
});
