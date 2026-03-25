import request from "supertest";
import {
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
  loadPrisma,
} from "./real-mode";

const validId = "550e8400-e29b-41d4-a716-446655440000";
const buildUpdatePayload = () => ({
  company_name: "PT Update Global",
  company_url: "https://update.global",
  position: "Senior Backend Engineer",
  job_source: "Referral",
  job_type: "contract",
  work_system: "hybrid",
  salary_min: 14000000,
  salary_max: 18000000,
  location: "Bandung",
  date: "2026-03-23",
  status: "hr_interview",
  result_status: "passed",
  contact_name: "Lead Recruiter",
  contact_email: "lead@update.global",
  contact_phone: "081111111111",
  follow_up_date: "2026-03-29",
  follow_up_note: "Interview teknis",
  job_url: "https://update.global/jobs/senior-backend",
  notes: "Relokasi dipertimbangkan",
});

let app: typeof import("../../src/index").default;
let ApplicationService: typeof import("../../src/services/application.service").ApplicationService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/application.service", () => ({
      ApplicationService: {
        update: jest.fn(),
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

describe("PUT /applications/:id", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("updates a application record", async () => {
    const updateMock = jest.mocked(ApplicationService.update);
    updateMock.mockResolvedValue({ id: validId, name: "Application Diperbarui" } as never);

    const response = await request(app)
      .put(`/applications/${validId}`).set("Authorization", "Bearer user-token")
      .send({ name: "Application Diperbarui" });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({ id: validId, name: "Application Diperbarui" });
    expect(typeof response.body.data.name).toBe("string");
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app)
      .put(`/applications/${validId}`)
      .send({ name: "Application Diperbarui" });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns validation errors for invalid updates", async () => {
    const updateMock = jest.mocked(ApplicationService.update);
    updateMock.mockRejectedValue(new ResponseErrorClass(400, "Payload tidak valid"));

    const response = await request(app)
      .put(`/applications/${validId}`).set("Authorization", "Bearer user-token")
      .send({ name: "" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Payload tidak valid");
  });
});

describe("PUT /applications/:id", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();

  afterEach(async () => {
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("updates an existing application record", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("applications-update");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const application = await prisma.application.create({
      data: {
        userId: user.id,
        companyName: "PT Old",
        position: "Backend Engineer",
        jobType: "full_time",
        workSystem: "remote",
        date: new Date("2026-03-21T00:00:00.000Z"),
        status: "submitted",
        resultStatus: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const payload = buildUpdatePayload();
    const response = await request(app)
      .put(`/applications/${application.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: application.id,
      company_name: payload.company_name,
      position: payload.position,
      status: payload.status,
      result_status: payload.result_status,
    });

    const updated = await prisma.application.findUnique({
      where: { id: application.id },
    });
    expect(updated?.companyName).toBe(payload.company_name);
    expect(updated?.position).toBe(payload.position);
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app)
      .put(`/applications/${validId}`)
      .send(buildUpdatePayload());

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns validation errors for invalid updates", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("applications-update-invalid");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const application = await prisma.application.create({
      data: {
        userId: user.id,
        companyName: "PT Old Invalid",
        position: "QA Engineer",
        jobType: "full_time",
        workSystem: "remote",
        date: new Date("2026-03-20T00:00:00.000Z"),
        status: "submitted",
        resultStatus: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const response = await request(app)
      .put(`/applications/${application.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        ...buildUpdatePayload(),
        salary_min: 30000000,
        salary_max: 10000000,
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.salary_max");
    expect(response.body.errors.salary_max[0]).toBe(
      "Gaji maksimal harus ≥ gaji minimal",
    );
  });
});
