import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/blog.service", () => ({
  BlogService: {
    getRelatedBlogs: jest.fn(),
  },
}));

import app from "../../src/index";
import { BlogService } from "../../src/services/blog.service";

describe("GET /blogs/:slug/related", () => {
  const getRelatedBlogsMock = jest.mocked(BlogService.getRelatedBlogs);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns related blogs for the requested slug", async () => {
    getRelatedBlogsMock.mockResolvedValue([
      { slug: "related-post", title: "Related Post" },
    ] as never);

    const response = await request(app).get("/blogs/sample-slug/related?limit=3");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data[0]).toMatchObject({
      slug: "related-post",
      title: "Related Post",
    });
    expect(getRelatedBlogsMock).toHaveBeenCalledWith("sample-slug", 3);
  });

  it("returns 404 when the source blog cannot be found", async () => {
    getRelatedBlogsMock.mockRejectedValue(new ResponseError(404, "Blog tidak ditemukan"));

    const response = await request(app).get("/blogs/missing/related");

    expect(response.status).toBe(404);
    expect(response.body.errors.general[0]).toBe("Blog tidak ditemukan");
  });

  it("supports an empty related blog list", async () => {
    getRelatedBlogsMock.mockResolvedValue([] as never);

    const response = await request(app).get("/blogs/sample-slug/related");

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
  });
});
