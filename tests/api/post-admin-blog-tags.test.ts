import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/admin/blog-tag.service", () => ({
  BlogTagService: {
    create: jest.fn(),
  },
}));

import app from "../../src/index";
import { BlogTagService } from "../../src/services/admin/blog-tag.service";

describe("POST /admin/blog-tags", () => {
  const createMock = jest.mocked(BlogTagService.create);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a blog tag record", async () => {
    createMock.mockResolvedValue({ id: "550e8400-e29b-41d4-a716-446655440000", name: "Blog Tag Baru" } as never);

    const response = await request(app)
      .post("/admin/blog-tags").set("Authorization", "Bearer admin-token")
      .send({ name: "Blog Tag Baru" });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({ id: "550e8400-e29b-41d4-a716-446655440000", name: "Blog Tag Baru" });
    expect(typeof response.body.data.id).toBe("string");
  });

  it("returns 403 when a non-admin user calls the endpoint", async () => {
    const response = await request(app)
      .post("/admin/blog-tags").set("Authorization", "Bearer user-token")
      .send({ name: "Blog Tag Baru" });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Admin access required");
  });

  it("returns validation errors for invalid payloads", async () => {
    createMock.mockRejectedValue(new ResponseError(400, "Payload tidak valid"));

    const response = await request(app)
      .post("/admin/blog-tags").set("Authorization", "Bearer admin-token")
      .send({ name: "" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Payload tidak valid");
  });
});
