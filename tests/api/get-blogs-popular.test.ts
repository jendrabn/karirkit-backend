import request from "supertest";

jest.mock("../../src/services/blog.service", () => ({
  BlogService: {
    getPopular: jest.fn(),
  },
}));

import app from "../../src/index";
import { BlogService } from "../../src/services/blog.service";

describe("GET /blogs/popular", () => {
  const getPopularMock = jest.mocked(BlogService.getPopular);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns popular blogs for the requested window", async () => {
    getPopularMock.mockResolvedValue([
      { slug: "popular-post", title: "Popular Post" },
    ] as never);

    const response = await request(app).get("/blogs/popular?limit=5&window=30d");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data[0]).toMatchObject({
      slug: "popular-post",
      title: "Popular Post",
    });
    expect(getPopularMock).toHaveBeenCalledWith(5, "30d");
  });

  it("returns service errors when the popular list cannot be generated", async () => {
    getPopularMock.mockRejectedValue(new Error("Popular blogs unavailable"));

    const response = await request(app).get("/blogs/popular");

    expect(response.status).toBe(500);
    expect(response.body.errors.general[0]).toBe("Popular blogs unavailable");
  });

  it("uses the default window and a clamped limit when the query is extreme", async () => {
    getPopularMock.mockResolvedValue([] as never);

    const response = await request(app).get("/blogs/popular?limit=0");

    expect(response.status).toBe(200);
    expect(getPopularMock).toHaveBeenCalledWith(4, "7d");
    expect(response.body.data).toEqual([]);
  });
});
