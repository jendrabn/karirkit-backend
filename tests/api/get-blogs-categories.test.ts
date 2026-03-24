import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/blog.service", () => ({
  BlogService: {
    getCategories: jest.fn(),
  },
}));

import app from "../../src/index";
import { BlogService } from "../../src/services/blog.service";

describe("GET /blogs/categories", () => {
  const getCategoriesMock = jest.mocked(BlogService.getCategories);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns blog categories inside data.items", async () => {
    getCategoriesMock.mockResolvedValue([
      { id: "cat-1", name: "Career" },
    ] as never);

    const response = await request(app).get("/blogs/categories");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(Array.isArray(response.body.data.items)).toBe(true);
    expect(response.body.data.items[0]).toMatchObject({
      id: "cat-1",
      name: "Career",
    });
  });

  it("returns service errors when categories cannot be loaded", async () => {
    getCategoriesMock.mockRejectedValue(new ResponseError(500, "Kategori blog gagal dimuat"));

    const response = await request(app).get("/blogs/categories");

    expect(response.status).toBe(500);
    expect(response.body.errors.general[0]).toBe("Kategori blog gagal dimuat");
  });

  it("supports an empty category list", async () => {
    getCategoriesMock.mockResolvedValue([] as never);

    const response = await request(app).get("/blogs/categories");

    expect(response.status).toBe(200);
    expect(response.body.data.items).toEqual([]);
  });
});
