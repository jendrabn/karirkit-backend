import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/application.service", () => ({
  ApplicationService: {
    get: jest.fn(),
  },
}));

import app from "../../src/index";
import { ApplicationService } from "../../src/services/application.service";

const validId = "550e8400-e29b-41d4-a716-446655440000";

describe("GET /applications/:id", () => {
  const getMock = jest.mocked(ApplicationService.get);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns application details", async () => {
    getMock.mockResolvedValue({ id: validId, name: "Application Detail" } as never);

    const response = await request(app)
      .get(`/applications/${validId}`).set("Authorization", "Bearer user-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({ id: validId, name: "Application Detail" });
    expect(typeof response.body.data.id).toBe("string");
  });

  it("returns 401 when authentication is missing", async () => {
    
    const response = await request(app)
      .get(`/applications/${validId}`);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated ".trim());
  });

  it("returns 404 when the application does not exist", async () => {
    getMock.mockRejectedValue(new ResponseError(404, "Application tidak ditemukan"));

    const response = await request(app)
      .get(`/applications/${validId}`).set("Authorization", "Bearer user-token");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Application tidak ditemukan");
  });
});
