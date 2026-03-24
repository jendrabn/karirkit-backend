import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/portfolio.service", () => ({
  PortfolioService: {
    update: jest.fn(),
  },
}));

import app from "../../src/index";
import { PortfolioService } from "../../src/services/portfolio.service";

const validId = "550e8400-e29b-41d4-a716-446655440000";

describe("PUT /portfolios/:id", () => {
  const updateMock = jest.mocked(PortfolioService.update);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("updates a portfolio record", async () => {
    updateMock.mockResolvedValue({ id: validId, name: "Portfolio Diperbarui" } as never);

    const response = await request(app)
      .put(`/portfolios/${validId}`).set("Authorization", "Bearer user-token")
      .send({ name: "Portfolio Diperbarui" });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({ id: validId, name: "Portfolio Diperbarui" });
    expect(typeof response.body.data.name).toBe("string");
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app)
      .put(`/portfolios/${validId}`)
      .send({ name: "Portfolio Diperbarui" });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns validation errors for invalid updates", async () => {
    updateMock.mockRejectedValue(new ResponseError(400, "Payload tidak valid"));

    const response = await request(app)
      .put(`/portfolios/${validId}`).set("Authorization", "Bearer user-token")
      .send({ name: "" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Payload tidak valid");
  });
});
