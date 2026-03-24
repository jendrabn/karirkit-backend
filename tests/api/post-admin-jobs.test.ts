import request from "supertest";

jest.mock("../../src/services/admin/job.service", () => ({
  AdminJobService: {
    create: jest.fn(),
  },
}));

import app from "../../src/index";
import { AdminJobService } from "../../src/services/admin/job.service";

describe("POST /admin/jobs", () => {
  const createMock = jest.mocked(AdminJobService.create);
  const companyId = "550e8400-e29b-41d4-a716-446655440001";
  const roleId = "550e8400-e29b-41d4-a716-446655440002";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a job posting for admins", async () => {
    createMock.mockResolvedValue({
      id: "job-1",
      title: "Senior Backend Engineer",
    } as never);

    const response = await request(app)
      .post("/admin/jobs")
      .set("Authorization", "Bearer admin-token")
      .send({
        company_id: companyId,
        job_role_id: roleId,
        city_id: "3171",
        title: "Senior Backend Engineer",
        job_type: "full_time",
        work_system: "remote",
        education_level: "bachelor",
        min_years_of_experience: 2,
        description: "Detailed backend engineering role.",
        requirements: "Detailed backend engineering requirements.",
        status: "published",
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: "job-1",
      title: "Senior Backend Engineer",
    });
  });

  it("returns 403 for non-admin users", async () => {
    const response = await request(app)
      .post("/admin/jobs")
      .set("Authorization", "Bearer user-token")
      .send({});

    expect(response.status).toBe(403);
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 400 when the job payload is invalid", async () => {
    const response = await request(app)
      .post("/admin/jobs")
      .set("Authorization", "Bearer admin-token")
      .send({
        company_id: companyId,
        job_role_id: roleId,
        title: "Hi",
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.title");
    expect(Array.isArray(response.body.errors.title)).toBe(true);
  });
});
