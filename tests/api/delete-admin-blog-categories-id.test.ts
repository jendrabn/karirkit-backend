import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/admin/blog-category.service", () => ({
  BlogCategoryService: {
    delete: jest.fn(),
  },
}));

import app from "../../src/index";
import { BlogCategoryService } from "../../src/services/admin/blog-category.service";

const validId = "550e8400-e29b-41d4-a716-446655440000";

describe("DELETE /admin/blog-categories/:id", () => {
  const deleteMock = jest.mocked(BlogCategoryService.delete);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deletes the blog category resource", async () => {
    deleteMock.mockResolvedValue(undefined as never);

    const response = await request(app)
      .delete(`/admin/blog-categories/${validId}`).set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
  });

  it("returns 403 for non-admin users", async () => {
    const response = await request(app)
      .delete(`/admin/blog-categories/${validId}`).set("Authorization", "Bearer user-token");

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns 404 when the blog category cannot be found", async () => {
    deleteMock.mockRejectedValue(new ResponseError(404, "Blog Category tidak ditemukan"));

    const response = await request(app)
      .delete(`/admin/blog-categories/${validId}`).set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Blog Category tidak ditemukan");
  });
});
