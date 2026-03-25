import request from "supertest";
import {
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
  loadPrisma,
} from "./real-mode";

let app: typeof import("../../src/index").default;
let AdminJobRoleService: typeof import("../../src/services/admin/job-role.service").AdminJobRoleService;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/admin/job-role.service", () => ({
      AdminJobRoleService: {
        create: jest.fn(),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ AdminJobRoleService } = await import(
    "../../src/services/admin/job-role.service"
  ));
});

afterAll(async () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    await disconnectPrisma();
  }
});

describe("POST /admin/job-roles", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a job role for admin users", async () => {
    const createMock = jest.mocked(AdminJobRoleService.create);
    createMock.mockResolvedValue({
      id: "role-1",
      name: "Backend Engineer",
    } as never);

    const response = await request(app)
      .post("/admin/job-roles")
      .set("Authorization", "Bearer admin-token")
      .send({
        name: "Backend Engineer",
      });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      id: "role-1",
      name: "Backend Engineer",
    });
  });

  it("returns 403 for non-admin users", async () => {
    const response = await request(app)
      .post("/admin/job-roles")
      .set("Authorization", "Bearer user-token")
      .send({});

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the job role payload is invalid", async () => {
    const response = await request(app)
      .post("/admin/job-roles")
      .set("Authorization", "Bearer admin-token")
      .send({
        name: "AB",
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.name");
    expect(Array.isArray(response.body.errors.name)).toBe(true);
  });
});

describe("POST /admin/job-roles", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();
  const trackedRoleIds = new Set<string>();

  afterEach(async () => {
    const prisma = await loadPrisma();
    if (trackedRoleIds.size > 0) {
      await prisma.jobRole.deleteMany({
        where: {
          id: { in: [...trackedRoleIds] },
        },
      });
    }
    trackedRoleIds.clear();
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("creates a job role for admin users", async () => {
    const prisma = await loadPrisma();
    const { user: admin } = await createRealUser("admin-job-roles-create", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .post("/admin/job-roles")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Backend Engineer Real",
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      name: "Backend Engineer Real",
      slug: "backend-engineer-real",
      job_count: 0,
    });
    trackedRoleIds.add(response.body.data.id);

    const saved = await prisma.jobRole.findUnique({
      where: { id: response.body.data.id },
    });
    expect(saved?.slug).toBe("backend-engineer-real");
  });

  it("returns 403 for non-admin users", async () => {
    const { user } = await createRealUser("admin-job-roles-create-forbidden");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .post("/admin/job-roles")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Backend Engineer" });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the job role payload is invalid", async () => {
    const { user: admin } = await createRealUser("admin-job-roles-create-invalid", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .post("/admin/job-roles")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "AB",
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.name");
    expect(Array.isArray(response.body.errors.name)).toBe(true);
  });
});
