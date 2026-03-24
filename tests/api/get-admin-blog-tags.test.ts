import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/admin/blog-tag.service", () => ({
  BlogTagService: {
    list: jest.fn(),
  },
}));

import app from "../../src/index";
import { BlogTagService } from "../../src/services/admin/blog-tag.service";

const validId = "550e8400-e29b-41d4-a716-446655440000";

describe("GET /admin/blog-tags", () => {
  const listMock = jest.mocked(BlogTagService.list);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a paginated blog tag list", async () => {
    listMock.mockResolvedValue({
      items: [{ id: validId, name: "Blog Tag 1" }],
      meta: { page: 1, per_page: 20, total: 1 },
    } as never);

    const response = await request(app)
      .get("/admin/blog-tags").set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body).toHaveProperty("data.meta");
    expect(Array.isArray(response.body.data.items)).toBe(true);
    expect(response.body.data.items[0]).toMatchObject({ id: validId, name: "Blog Tag 1" });
    expect(typeof response.body.data.meta.total).toBe("number");
  });

  it("returns 403 when a non-admin user accesses the endpoint", async () => {
    
    const response = await request(app)
      .get("/admin/blog-tags").set("Authorization", "Bearer user-token");

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("supports an empty blog tag state", async () => {
    listMock.mockResolvedValue({ items: [], meta: { page: 1, per_page: 20, total: 0 } } as never);

    const response = await request(app)
      .get("/admin/blog-tags").set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body.data.items).toEqual([]);
    expect(response.body.data.meta.total).toBe(0);
  });
});
