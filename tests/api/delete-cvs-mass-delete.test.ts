import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/cv.service", () => ({
  CvService: {
    massDelete: jest.fn(),
  },
}));

import app from "../../src/index";
import { CvService } from "../../src/services/cv.service";

describe("DELETE /cvs/mass-delete", () => {
  const massDeleteMock = jest.mocked(CvService.massDelete);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deletes multiple cv records", async () => {
    massDeleteMock.mockResolvedValue({ deleted_count: 2, ids: ["550e8400-e29b-41d4-a716-446655440000", "660e8400-e29b-41d4-a716-446655440000"] } as never);

    const response = await request(app)
      .delete("/cvs/mass-delete").set("Authorization", "Bearer user-token")
      .send({ ids: ["550e8400-e29b-41d4-a716-446655440000", "660e8400-e29b-41d4-a716-446655440000"] });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({ deleted_count: 2, ids: ["550e8400-e29b-41d4-a716-446655440000", "660e8400-e29b-41d4-a716-446655440000"] });
    expect(typeof response.body.data.deleted_count).toBe("number");
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app)
      .delete("/cvs/mass-delete")
      .send({ ids: ["550e8400-e29b-41d4-a716-446655440000"] });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns validation errors when no ids are provided", async () => {
    massDeleteMock.mockRejectedValue(new ResponseError(400, "Minimal satu data harus dipilih"));

    const response = await request(app)
      .delete("/cvs/mass-delete").set("Authorization", "Bearer user-token")
      .send({ ids: [] });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Minimal satu data harus dipilih");
  });
});
