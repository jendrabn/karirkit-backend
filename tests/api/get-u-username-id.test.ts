import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/public-portfolio.service", () => ({
  PublicPortfolioService: {
    getPortfolioDetail: jest.fn(),
  },
}));

import app from "../../src/index";
import { PublicPortfolioService } from "../../src/services/public-portfolio.service";

const validId = "550e8400-e29b-41d4-a716-446655440000";

describe("GET /u/@:username/:id", () => {
  const getPortfolioDetailMock = jest.mocked(PublicPortfolioService.getPortfolioDetail);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a public portfolio detail", async () => {
    getPortfolioDetailMock.mockResolvedValue({
      id: validId,
      title: "Frontend Portfolio",
      username: "johndoe",
      projects: [{ id: "project-1", title: "Landing Page" }],
    } as never);

    const response = await request(app)
      .get(`/u/@johndoe/${validId}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: validId,
      title: "Frontend Portfolio",
      username: "johndoe",
    });
    expect(response.body.data.projects[0]).toMatchObject({
      id: "project-1",
      title: "Landing Page",
    });
    expect(typeof response.body.data.id).toBe("string");
  });

  it("returns 404 when the resource is not found", async () => {
    getPortfolioDetailMock.mockRejectedValue(new ResponseError(404, "Portfolio tidak ditemukan"));
    const response = await request(app)
      .get(`/u/@johndoe/${validId}`);

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Portfolio tidak ditemukan ".trim());
  });

  it("supports portfolio details that have empty collections", async () => {
    getPortfolioDetailMock.mockResolvedValue({
      id: validId,
      title: "Frontend Portfolio",
      username: "johndoe",
      projects: [],
    } as never);

    const response = await request(app)
      .get(`/u/@johndoe/${validId}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.projects");
    expect(response.body.data.id).toBe(validId);
    expect(response.body.data.projects).toEqual([]);
  });
});
