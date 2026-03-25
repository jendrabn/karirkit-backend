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
let AdminJobRoleService: typeof import("../../src/services/admin/job-role.service").AdminJobRoleService;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/admin/job-role.service", () => ({
      AdminJobRoleService: {
        update: jest.fn(),
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

describe("PUT /admin/job-roles/:id", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("updates a job role for admin users", async () => {
    const updateMock = jest.mocked(AdminJobRoleService.update);
    updateMock.mockResolvedValue({
      id: validId,
      name: "Updated Backend Engineer",
    } as never);

    const response = await request(app)
      .put(`/admin/job-roles/${validId}`)
      .set("Authorization", "Bearer admin-token")
      .send({
        name: "Updated Backend Engineer",
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: validId,
      name: "Updated Backend Engineer",
    });
  });

  it("returns 403 for non-admin users", async () => {
    const response = await request(app)
      .put(`/admin/job-roles/${validId}`)
      .set("Authorization", "Bearer user-token")
      .send({});

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the job role update payload is invalid", async () => {
    const response = await request(app)
      .put(`/admin/job-roles/${validId}`)
      .set("Authorization", "Bearer admin-token")
      .send({
        name: "AB",
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.name");
    expect(Array.isArray(response.body.errors.name)).toBe(true);
  });
});

describe("PUT /admin/job-roles/:id", () => {
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

  it("updates a job role for admin users", async () => {
    const prisma = await loadPrisma();
    const { user: admin } = await createRealUser("admin-job-roles-update", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);
    const jobRole = await prisma.jobRole.create({
      data: {
        name: "Backend Engineer Legacy",
        slug: "backend-engineer-legacy-real",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedRoleIds.add(jobRole.id);

    const response = await request(app)
      .put(`/admin/job-roles/${jobRole.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Updated Backend Engineer Real",
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: jobRole.id,
      name: "Updated Backend Engineer Real",
      slug: "updated-backend-engineer-real",
    });

    const updated = await prisma.jobRole.findUnique({
      where: { id: jobRole.id },
    });
    expect(updated?.slug).toBe("updated-backend-engineer-real");
  });

  it("returns 403 for non-admin users", async () => {
    const { user } = await createRealUser("admin-job-roles-update-forbidden");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .put(`/admin/job-roles/${validId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Updated Backend Engineer",
      });

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the job role update payload is invalid", async () => {
    const { user: admin } = await createRealUser("admin-job-roles-update-invalid", {
      role: "admin",
    });
    trackedEmails.add(admin.email);
    const token = await createSessionToken(admin);

    const response = await request(app)
      .put(`/admin/job-roles/${validId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "AB",
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.name");
    expect(Array.isArray(response.body.errors.name)).toBe(true);
  });
});
