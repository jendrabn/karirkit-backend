import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/admin/blog-tag.service", () => ({
  BlogTagService: {
    get: jest.fn(),
  },
}));

import app from "../../src/index";
import { BlogTagService } from "../../src/services/admin/blog-tag.service";

const validId = "550e8400-e29b-41d4-a716-446655440000";

describe("GET /admin/blog-tags/:id", () => {
  const getMock = jest.mocked(BlogTagService.get);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns blog tag details", async () => {
    getMock.mockResolvedValue({ id: validId, name: "Blog Tag Detail" } as never);

    const response = await request(app)
      .get(`/admin/blog-tags/${validId}`).set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({ id: validId, name: "Blog Tag Detail" });
    expect(typeof response.body.data.id).toBe("string");
  });

  it("returns 403 when the requester is not an admin", async () => {
    
    const response = await request(app)
      .get(`/admin/blog-tags/${validId}`).set("Authorization", "Bearer user-token");

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required ".trim());
  });

  it("returns 404 when the blog tag does not exist", async () => {
    getMock.mockRejectedValue(new ResponseError(404, "Blog Tag tidak ditemukan"));

    const response = await request(app)
      .get(`/admin/blog-tags/${validId}`).set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Blog Tag tidak ditemukan");
  });
});
