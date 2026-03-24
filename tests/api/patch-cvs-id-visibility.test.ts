import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/cv.service", () => ({
  CvService: {
    updateSlugVisibility: jest.fn(),
  },
}));

import app from "../../src/index";
import { CvService } from "../../src/services/cv.service";

const validId = "550e8400-e29b-41d4-a716-446655440000";

describe("PATCH /cvs/:id/visibility", () => {
  const updateSlugVisibilityMock = jest.mocked(CvService.updateSlugVisibility);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("updates cv visibility", async () => {
    updateSlugVisibilityMock.mockResolvedValue({
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "is_public": true
} as never);

    const response = await request(app)
      .patch(`/cvs/${validId}/visibility`).set("Authorization", "Bearer user-token")
      .send({
  "is_public": true
});

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "is_public": true
});
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app)
      .patch(`/cvs/${validId}/visibility`)
      .send({
  "is_public": true
});

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns validation errors for invalid patch payloads", async () => {
    updateSlugVisibilityMock.mockRejectedValue(new ResponseError(400, "Payload tidak valid"));

    const response = await request(app)
      .patch(`/cvs/${validId}/visibility`).set("Authorization", "Bearer user-token")
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Payload tidak valid");
  });
});
