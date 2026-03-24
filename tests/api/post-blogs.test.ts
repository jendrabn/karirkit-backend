import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/blog.service", () => ({
  BlogService: {
    create: jest.fn(),
  },
}));

import app from "../../src/index";
import { BlogService } from "../../src/services/blog.service";

describe("POST /blogs", () => {
  const createMock = jest.mocked(BlogService.create);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a blog record", async () => {
    createMock.mockResolvedValue({ id: "550e8400-e29b-41d4-a716-446655440000", name: "Blog Baru" } as never);

    const response = await request(app)
      .post("/blogs").set("Authorization", "Bearer user-token")
      .send({ name: "Blog Baru" });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({ id: "550e8400-e29b-41d4-a716-446655440000", name: "Blog Baru" });
    expect(typeof response.body.data.id).toBe("string");
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app)
      .post("/blogs")
      .send({ name: "Blog Baru" });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns validation errors for invalid payloads", async () => {
    createMock.mockRejectedValue(new ResponseError(400, "Payload tidak valid"));

    const response = await request(app)
      .post("/blogs").set("Authorization", "Bearer user-token")
      .send({ name: "" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Payload tidak valid");
  });
});
