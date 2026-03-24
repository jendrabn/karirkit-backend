import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/blog.service", () => ({
  BlogService: {
    update: jest.fn(),
  },
}));

import app from "../../src/index";
import { BlogService } from "../../src/services/blog.service";

const validId = "550e8400-e29b-41d4-a716-446655440000";

describe("PUT /blogs/admin/:id", () => {
  const updateMock = jest.mocked(BlogService.update);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("updates a blog record", async () => {
    updateMock.mockResolvedValue({ id: validId, name: "Blog Diperbarui" } as never);

    const response = await request(app)
      .put(`/blogs/admin/${validId}`).set("Authorization", "Bearer user-token")
      .send({ name: "Blog Diperbarui" });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({ id: validId, name: "Blog Diperbarui" });
    expect(typeof response.body.data.name).toBe("string");
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app)
      .put(`/blogs/admin/${validId}`)
      .send({ name: "Blog Diperbarui" });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns validation errors for invalid updates", async () => {
    updateMock.mockRejectedValue(new ResponseError(400, "Payload tidak valid"));

    const response = await request(app)
      .put(`/blogs/admin/${validId}`).set("Authorization", "Bearer user-token")
      .send({ name: "" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Payload tidak valid");
  });
});
