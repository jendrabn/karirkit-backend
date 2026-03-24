import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/blog.service", () => ({
  BlogService: {
    delete: jest.fn(),
  },
}));

import app from "../../src/index";
import { BlogService } from "../../src/services/blog.service";

const validId = "550e8400-e29b-41d4-a716-446655440000";

describe("DELETE /blogs/admin/:id", () => {
  const deleteMock = jest.mocked(BlogService.delete);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deletes the blog resource", async () => {
    deleteMock.mockResolvedValue(undefined as never);

    const response = await request(app)
      .delete(`/blogs/admin/${validId}`).set("Authorization", "Bearer user-token");

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app)
      .delete(`/blogs/admin/${validId}`);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 404 when the blog cannot be found", async () => {
    deleteMock.mockRejectedValue(new ResponseError(404, "Blog tidak ditemukan"));

    const response = await request(app)
      .delete(`/blogs/admin/${validId}`).set("Authorization", "Bearer user-token");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Blog tidak ditemukan");
  });
});
