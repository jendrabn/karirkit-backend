import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/application-letter.service", () => ({
  ApplicationLetterService: {
    duplicate: jest.fn(),
  },
}));

import app from "../../src/index";
import { ApplicationLetterService } from "../../src/services/application-letter.service";

const validId = "550e8400-e29b-41d4-a716-446655440000";

describe("POST /application-letters/:id/duplicate", () => {
  const duplicateMock = jest.mocked(ApplicationLetterService.duplicate);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("duplicates the application letter record", async () => {
    duplicateMock.mockResolvedValue({ id: "660e8400-e29b-41d4-a716-446655440000", name: "Application Letter Salinan" } as never);

    const response = await request(app)
      .post(`/application-letters/${validId}/duplicate`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({ id: "660e8400-e29b-41d4-a716-446655440000", name: "Application Letter Salinan" });
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).post(`/application-letters/${validId}/duplicate`);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 404 when the application letter cannot be duplicated", async () => {
    duplicateMock.mockRejectedValue(new ResponseError(404, "Application Letter tidak ditemukan"));

    const response = await request(app)
      .post(`/application-letters/${validId}/duplicate`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Application Letter tidak ditemukan");
  });
});
