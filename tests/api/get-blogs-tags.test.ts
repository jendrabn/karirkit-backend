import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/blog.service", () => ({
  BlogService: {
    getTags: jest.fn(),
  },
}));

import app from "../../src/index";
import { BlogService } from "../../src/services/blog.service";

describe("GET /blogs/tags", () => {
  const getTagsMock = jest.mocked(BlogService.getTags);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns blog tags inside data.items", async () => {
    getTagsMock.mockResolvedValue([
      { id: "tag-1", name: "Interview" },
    ] as never);

    const response = await request(app).get("/blogs/tags");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(Array.isArray(response.body.data.items)).toBe(true);
    expect(response.body.data.items[0]).toMatchObject({
      id: "tag-1",
      name: "Interview",
    });
  });

  it("returns service errors when tags cannot be loaded", async () => {
    getTagsMock.mockRejectedValue(new ResponseError(500, "Tag blog gagal dimuat"));

    const response = await request(app).get("/blogs/tags");

    expect(response.status).toBe(500);
    expect(response.body.errors.general[0]).toBe("Tag blog gagal dimuat");
  });

  it("supports an empty tag list", async () => {
    getTagsMock.mockResolvedValue([] as never);

    const response = await request(app).get("/blogs/tags");

    expect(response.status).toBe(200);
    expect(response.body.data.items).toEqual([]);
  });
});
