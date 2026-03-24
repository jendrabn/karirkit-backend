import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/portfolio.service", () => ({
  PortfolioService: {
    delete: jest.fn(),
  },
}));

import app from "../../src/index";
import { PortfolioService } from "../../src/services/portfolio.service";

const validId = "550e8400-e29b-41d4-a716-446655440000";

describe("DELETE /portfolios/:id", () => {
  const deleteMock = jest.mocked(PortfolioService.delete);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deletes the portfolio resource", async () => {
    deleteMock.mockResolvedValue(undefined as never);

    const response = await request(app)
      .delete(`/portfolios/${validId}`).set("Authorization", "Bearer user-token");

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app)
      .delete(`/portfolios/${validId}`);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 404 when the portfolio cannot be found", async () => {
    deleteMock.mockRejectedValue(new ResponseError(404, "Portfolio tidak ditemukan"));

    const response = await request(app)
      .delete(`/portfolios/${validId}`).set("Authorization", "Bearer user-token");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Portfolio tidak ditemukan");
  });
});
