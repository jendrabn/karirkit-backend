import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/admin/blog.service", () => ({
  BlogService: {
    get: jest.fn(),
  },
}));

import app from "../../src/index";
import { BlogService } from "../../src/services/admin/blog.service";

const validId = "550e8400-e29b-41d4-a716-446655440000";

describe("GET /admin/blogs/:id", () => {
  const getMock = jest.mocked(BlogService.get);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns admin blog details", async () => {
    getMock.mockResolvedValue({ id: validId, name: "Admin Blog Detail" } as never);

    const response = await request(app)
      .get(`/admin/blogs/${validId}`).set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({ id: validId, name: "Admin Blog Detail" });
    expect(typeof response.body.data.id).toBe("string");
  });

  it("returns 403 when the requester is not an admin", async () => {
    
    const response = await request(app)
      .get(`/admin/blogs/${validId}`).set("Authorization", "Bearer user-token");

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required ".trim());
  });

  it("returns 404 when the admin blog does not exist", async () => {
    getMock.mockRejectedValue(new ResponseError(404, "Admin Blog tidak ditemukan"));

    const response = await request(app)
      .get(`/admin/blogs/${validId}`).set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin Blog tidak ditemukan");
  });
});
