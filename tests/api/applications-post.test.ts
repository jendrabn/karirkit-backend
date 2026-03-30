import request from "supertest";
import {
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
  loadPrisma,
} from "./real-mode";

const buildApplicationPayload = () => ({
  company_name: "PT Karir Global",
  company_url: "https://karir.global",
  position: "Backend Engineer",
  job_source: "LinkedIn",
  job_type: "full_time",
  work_system: "remote",
  salary_min: 10000000,
  salary_max: 15000000,
  location: "Jakarta",
  date: "2026-03-20",
  status: "submitted",
  result_status: "pending",
  contact_name: "HR Karir Global",
  contact_email: "hr@karir.global",
  contact_phone: "081234567890",
  follow_up_date: "2026-03-27",
  follow_up_note: "Follow up via email",
  job_url: "https://karir.global/jobs/backend-engineer",
  notes: "Prioritas utama",
});

let app: typeof import("../../src/index").default;
let ApplicationService: typeof import("../../src/services/application.service").ApplicationService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;
let prismaMock: typeof import("../../src/config/prisma.config").prisma;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/config/prisma.config", () => ({
      prisma: {
        application: { count: jest.fn() },
      },
    }));
    jest.doMock("../../src/services/application-letter.service", () => ({
      ApplicationLetterService: {},
    }));
    jest.doMock("../../src/services/application.service", () => ({
      ApplicationService: {
        create: jest.fn(),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ prisma: prismaMock } = await import("../../src/config/prisma.config"));
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

describe("POST /applications", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  const getPrisma = () =>
    prismaMock as unknown as {
      application: { count: jest.Mock };
    };

  beforeEach(() => {
    jest.clearAllMocks();
    getPrisma().application.count.mockResolvedValue(0);
  });

  it("creates a application record", async () => {
    const createMock = jest.mocked(ApplicationService.create);
    createMock.mockResolvedValue({ id: "550e8400-e29b-41d4-a716-446655440000", name: "Application Baru" } as never);

    const response = await request(app)
      .post("/applications").set("Authorization", "Bearer user-token")
      .send({ name: "Application Baru" });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({ id: "550e8400-e29b-41d4-a716-446655440000", name: "Application Baru" });
    expect(typeof response.body.data.id).toBe("string");
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app)
      .post("/applications")
      .send({ name: "Application Baru" });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns validation errors for invalid payloads", async () => {
    const createMock = jest.mocked(ApplicationService.create);
    createMock.mockRejectedValue(new ResponseErrorClass(400, "Payload tidak valid"));

    const response = await request(app)
      .post("/applications").set("Authorization", "Bearer user-token")
      .send({ name: "" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Payload tidak valid");
  });

  it("blocks creation when the free application tracker limit is reached", async () => {
    const prisma = getPrisma();
    prisma.application.count.mockResolvedValue(100);

    const response = await request(app)
      .post("/applications").set("Authorization", "Bearer user-token")
      .send(buildApplicationPayload());

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe(
      "Batas maksimum application tracker telah tercapai"
    );
    expect(response.body.code).toBe("APPLICATION_LIMIT_REACHED");
  });

  it("also blocks admins when their plan application tracker limit is reached", async () => {
    const prisma = getPrisma();
    prisma.application.count.mockResolvedValue(100);

    const response = await request(app)
      .post("/applications")
      .set("Authorization", "Bearer admin-free-token")
      .send(buildApplicationPayload());

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe(
      "Batas maksimum application tracker telah tercapai"
    );
    expect(response.body.code).toBe("APPLICATION_LIMIT_REACHED");
  });
});

describe("POST /applications", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();

  afterEach(async () => {
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("creates an application record in the database", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("applications-create");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const payload = buildApplicationPayload();

    const response = await request(app)
      .post("/applications")
      .set("Authorization", `Bearer ${token}`)
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      user_id: user.id,
      company_name: payload.company_name,
      position: payload.position,
      job_type: payload.job_type,
      work_system: payload.work_system,
      salary_min: payload.salary_min,
      salary_max: payload.salary_max,
      status: payload.status,
      result_status: payload.result_status,
    });
    expect(typeof response.body.data.id).toBe("string");

    const saved = await prisma.application.findUnique({
      where: { id: response.body.data.id },
    });
    expect(saved).not.toBeNull();
    expect(saved?.companyName).toBe(payload.company_name);
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app).post("/applications").send(
      buildApplicationPayload(),
    );

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns validation errors for invalid salary ranges", async () => {
    const { user } = await createRealUser("applications-create-invalid");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .post("/applications")
      .set("Authorization", `Bearer ${token}`)
      .send({
        ...buildApplicationPayload(),
        salary_min: 20000000,
        salary_max: 10000000,
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.salary_max");
    expect(response.body.errors.salary_max[0]).toBe(
      "Gaji maksimal harus ≥ gaji minimal",
    );
  });
});
