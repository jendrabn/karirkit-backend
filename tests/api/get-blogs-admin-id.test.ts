import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/blog.service", () => ({
  BlogService: {
    get: jest.fn(),
  },
}));

import app from "../../src/index";
import { BlogService } from "../../src/services/blog.service";

const validId = "550e8400-e29b-41d4-a716-446655440000";

describe("GET /blogs/admin/:id", () => {
  const getMock = jest.mocked(BlogService.get);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns blog details", async () => {
    getMock.mockResolvedValue({ id: validId, name: "Blog Detail" } as never);

    const response = await request(app)
      .get(`/blogs/admin/${validId}`).set("Authorization", "Bearer user-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({ id: validId, name: "Blog Detail" });
    expect(typeof response.body.data.id).toBe("string");
  });

  it("returns 401 when authentication is missing", async () => {
    
    const response = await request(app)
      .get(`/blogs/admin/${validId}`);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated ".trim());
  });

  it("returns 404 when the blog does not exist", async () => {
    getMock.mockRejectedValue(new ResponseError(404, "Blog tidak ditemukan"));

    const response = await request(app)
      .get(`/blogs/admin/${validId}`).set("Authorization", "Bearer user-token");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Blog tidak ditemukan");
  });
});
