import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/application-letter.service", () => ({
  ApplicationLetterService: {
    get: jest.fn(),
  },
}));

import app from "../../src/index";
import { ApplicationLetterService } from "../../src/services/application-letter.service";

const validId = "550e8400-e29b-41d4-a716-446655440000";

describe("GET /application-letters/:id", () => {
  const getMock = jest.mocked(ApplicationLetterService.get);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns application letter details", async () => {
    getMock.mockResolvedValue({ id: validId, name: "Application Letter Detail" } as never);

    const response = await request(app)
      .get(`/application-letters/${validId}`).set("Authorization", "Bearer user-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({ id: validId, name: "Application Letter Detail" });
    expect(typeof response.body.data.id).toBe("string");
  });

  it("returns 401 when authentication is missing", async () => {
    
    const response = await request(app)
      .get(`/application-letters/${validId}`);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated ".trim());
  });

  it("returns 404 when the application letter does not exist", async () => {
    getMock.mockRejectedValue(new ResponseError(404, "Application Letter tidak ditemukan"));

    const response = await request(app)
      .get(`/application-letters/${validId}`).set("Authorization", "Bearer user-token");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Application Letter tidak ditemukan");
  });
});
