import request from "supertest";

jest.mock("../../src/services/blog.service", () => ({
  BlogService: {
    getLatest: jest.fn(),
  },
}));

import app from "../../src/index";
import { BlogService } from "../../src/services/blog.service";

describe("GET /blogs/latest", () => {
  const getLatestMock = jest.mocked(BlogService.getLatest);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the latest published blogs", async () => {
    getLatestMock.mockResolvedValue([
      { slug: "latest-post", title: "Latest Post" },
    ] as never);

    const response = await request(app).get("/blogs/latest?limit=6");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data[0]).toMatchObject({
      slug: "latest-post",
      title: "Latest Post",
    });
    expect(getLatestMock).toHaveBeenCalledWith(6);
  });

  it("returns service errors when latest blogs cannot be loaded", async () => {
    getLatestMock.mockRejectedValue(new Error("Latest blogs unavailable"));

    const response = await request(app).get("/blogs/latest");

    expect(response.status).toBe(500);
    expect(response.body.errors.general[0]).toBe("Latest blogs unavailable");
  });

  it("clamps the limit query parameter to the controller maximum", async () => {
    getLatestMock.mockResolvedValue([] as never);

    const response = await request(app).get("/blogs/latest?limit=999");

    expect(response.status).toBe(200);
    expect(getLatestMock).toHaveBeenCalledWith(20);
    expect(response.body.data).toEqual([]);
  });
});
