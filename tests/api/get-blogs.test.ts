import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/blog.service", () => ({
  BlogService: {
    list: jest.fn(),
  },
}));

import app from "../../src/index";
import { BlogService } from "../../src/services/blog.service";

const validId = "550e8400-e29b-41d4-a716-446655440000";

describe("GET /blogs", () => {
  const listMock = jest.mocked(BlogService.list);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a paginated blog list", async () => {
    listMock.mockResolvedValue({
      items: [{ id: validId, name: "Blog 1" }],
      meta: { page: 1, per_page: 20, total: 1 },
    } as never);

    const response = await request(app)
      .get("/blogs");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body).toHaveProperty("data.meta");
    expect(Array.isArray(response.body.data.items)).toBe(true);
    expect(response.body.data.items[0]).toMatchObject({ id: validId, name: "Blog 1" });
    expect(typeof response.body.data.meta.total).toBe("number");
  });

  it("returns 400 when the service rejects the request", async () => {
    listMock.mockRejectedValue(new ResponseError(400, "Permintaan tidak valid"));
    const response = await request(app)
      .get("/blogs");

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Permintaan tidak valid");
  });

  it("supports an empty blog state", async () => {
    listMock.mockResolvedValue({ items: [], meta: { page: 1, per_page: 20, total: 0 } } as never);

    const response = await request(app)
      .get("/blogs");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body.data.items).toEqual([]);
    expect(response.body.data.meta.total).toBe(0);
  });
});
