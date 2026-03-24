import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/blog.service", () => ({
  BlogService: {
    getBySlug: jest.fn(),
  },
}));

import app from "../../src/index";
import { BlogService } from "../../src/services/blog.service";

const validId = "550e8400-e29b-41d4-a716-446655440000";

describe("GET /blogs/:slug", () => {
  const getBySlugMock = jest.mocked(BlogService.getBySlug);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a blog detail by slug", async () => {
    getBySlugMock.mockResolvedValue({
      id: validId,
      slug: "sample-slug",
      title: "Blog Detail",
      tags: [{ id: "tag-1", name: "Career" }],
    } as never);

    const response = await request(app)
      .get("/blogs/sample-slug");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: validId,
      slug: "sample-slug",
      title: "Blog Detail",
    });
    expect(response.body.data.tags[0]).toMatchObject({
      id: "tag-1",
      name: "Career",
    });
    expect(typeof response.body.data.id).toBe("string");
  });

  it("returns 404 when the resource is not found", async () => {
    getBySlugMock.mockRejectedValue(new ResponseError(404, "Blog tidak ditemukan"));
    const response = await request(app)
      .get("/blogs/sample-slug");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Blog tidak ditemukan ".trim());
  });

  it("supports blogs that have no tags", async () => {
    getBySlugMock.mockResolvedValue({
      id: validId,
      slug: "sample-slug",
      title: "Blog Detail",
      tags: [],
    } as never);

    const response = await request(app)
      .get("/blogs/sample-slug");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.tags");
    expect(response.body.data.slug).toBe("sample-slug");
    expect(response.body.data.tags).toEqual([]);
  });
});
