import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/cv.service", () => ({
  CvService: {
    update: jest.fn(),
  },
}));

import app from "../../src/index";
import { CvService } from "../../src/services/cv.service";

const validId = "550e8400-e29b-41d4-a716-446655440000";

describe("PUT /cvs/:id", () => {
  const updateMock = jest.mocked(CvService.update);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("updates a cv record", async () => {
    updateMock.mockResolvedValue({ id: validId, name: "CV Diperbarui" } as never);

    const response = await request(app)
      .put(`/cvs/${validId}`).set("Authorization", "Bearer user-token")
      .send({ name: "CV Diperbarui" });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({ id: validId, name: "CV Diperbarui" });
    expect(typeof response.body.data.name).toBe("string");
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app)
      .put(`/cvs/${validId}`)
      .send({ name: "CV Diperbarui" });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns validation errors for invalid updates", async () => {
    updateMock.mockRejectedValue(new ResponseError(400, "Payload tidak valid"));

    const response = await request(app)
      .put(`/cvs/${validId}`).set("Authorization", "Bearer user-token")
      .send({ name: "" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Payload tidak valid");
  });
});
