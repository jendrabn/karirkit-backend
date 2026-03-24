import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/admin/blog.service", () => ({
  BlogService: {
    massDelete: jest.fn(),
  },
}));

import app from "../../src/index";
import { BlogService } from "../../src/services/admin/blog.service";

describe("DELETE /admin/blogs/mass-delete", () => {
  const massDeleteMock = jest.mocked(BlogService.massDelete);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deletes multiple admin blog records", async () => {
    massDeleteMock.mockResolvedValue({ deleted_count: 2, ids: ["550e8400-e29b-41d4-a716-446655440000", "660e8400-e29b-41d4-a716-446655440000"] } as never);

    const response = await request(app)
      .delete("/admin/blogs/mass-delete").set("Authorization", "Bearer admin-token")
      .send({ ids: ["550e8400-e29b-41d4-a716-446655440000", "660e8400-e29b-41d4-a716-446655440000"] });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({ deleted_count: 2, ids: ["550e8400-e29b-41d4-a716-446655440000", "660e8400-e29b-41d4-a716-446655440000"] });
    expect(typeof response.body.data.deleted_count).toBe("number");
  });

  it("returns 403 for non-admin users", async () => {
    const response = await request(app)
      .delete("/admin/blogs/mass-delete").set("Authorization", "Bearer user-token")
      .send({ ids: ["550e8400-e29b-41d4-a716-446655440000"] });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns validation errors when no ids are provided", async () => {
    massDeleteMock.mockRejectedValue(new ResponseError(400, "Minimal satu data harus dipilih"));

    const response = await request(app)
      .delete("/admin/blogs/mass-delete").set("Authorization", "Bearer admin-token")
      .send({ ids: [] });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Minimal satu data harus dipilih");
  });
});
