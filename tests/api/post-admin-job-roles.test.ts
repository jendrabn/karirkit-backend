import request from "supertest";

jest.mock("../../src/services/admin/job-role.service", () => ({
  AdminJobRoleService: {
    create: jest.fn(),
  },
}));

import app from "../../src/index";
import { AdminJobRoleService } from "../../src/services/admin/job-role.service";

describe("POST /admin/job-roles", () => {
  const createMock = jest.mocked(AdminJobRoleService.create);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a job role for admin users", async () => {
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
