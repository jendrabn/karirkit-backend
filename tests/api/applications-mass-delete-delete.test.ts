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
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/application.service", () => ({
      ApplicationService: {
        massDelete: jest.fn(),
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

describe("DELETE /applications/mass-delete", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deletes multiple application records", async () => {
    const massDeleteMock = jest.mocked(ApplicationService.massDelete);
    massDeleteMock.mockResolvedValue({
      message: "2 lamaran berhasil dihapus",
      deleted_count: 2,
    } as never);

    const response = await request(app)
      .delete("/applications/mass-delete")
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
      message: "2 lamaran berhasil dihapus",
      deleted_count: 2,
    });
    expect(typeof response.body.data.deleted_count).toBe("number");
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app)
      .delete("/applications/mass-delete")
      .send({ ids: ["550e8400-e29b-41d4-a716-446655440000"] });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns validation errors when no ids are provided", async () => {
    const massDeleteMock = jest.mocked(ApplicationService.massDelete);
    massDeleteMock.mockRejectedValue(
      new ResponseErrorClass(400, "Validation error", {
        ids: ["Minimal satu ID harus dipilih"],
      }),
    );

    const response = await request(app)
      .delete("/applications/mass-delete")
      .set("Authorization", "Bearer user-token")
      .send({ ids: [] });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.ids");
    expect(Array.isArray(response.body.errors.ids)).toBe(true);
  });
});

describe("DELETE /applications/mass-delete", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();

  afterEach(async () => {
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("deletes multiple application records", async () => {
    const prisma = await loadPrisma();
    const now = new Date();
    const { user } = await createRealUser("applications-mass-delete");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const first = await prisma.application.create({
      data: {
        userId: user.id,
        companyName: "Mass Delete Alpha",
        position: "Backend Engineer",
        jobType: "full_time",
        workSystem: "remote",
        date: now,
        status: "submitted",
        resultStatus: "pending",
        createdAt: now,
        updatedAt: now,
      },
    });
    const second = await prisma.application.create({
      data: {
        userId: user.id,
        companyName: "Mass Delete Beta",
        position: "Frontend Engineer",
        jobType: "contract",
        workSystem: "hybrid",
        date: now,
        status: "draft",
        resultStatus: "pending",
        createdAt: now,
        updatedAt: now,
      },
    });

    const response = await request(app)
      .delete("/applications/mass-delete")
      .set("Authorization", `Bearer ${token}`)
      .send({ ids: [first.id, second.id] });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      message: "2 lamaran berhasil dihapus",
      deleted_count: 2,
    });

    const remaining = await prisma.application.findMany({
      where: { id: { in: [first.id, second.id] } },
    });
    expect(remaining).toHaveLength(0);
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app)
      .delete("/applications/mass-delete")
      .send({ ids: ["550e8400-e29b-41d4-a716-446655440000"] });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns validation errors when no ids are provided", async () => {
    const { user } = await createRealUser("applications-mass-delete-invalid");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .delete("/applications/mass-delete")
      .set("Authorization", `Bearer ${token}`)
      .send({ ids: [] });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.ids");
    expect(Array.isArray(response.body.errors.ids)).toBe(true);
  });
});
