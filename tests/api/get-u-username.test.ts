import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/public-portfolio.service", () => ({
  PublicPortfolioService: {
    listByUsername: jest.fn(),
  },
}));

import app from "../../src/index";
import { PublicPortfolioService } from "../../src/services/public-portfolio.service";

const validId = "550e8400-e29b-41d4-a716-446655440000";

describe("GET /u/@:username", () => {
  const listByUsernameMock = jest.mocked(PublicPortfolioService.listByUsername);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a public portfolio listing for the username", async () => {
    listByUsernameMock.mockResolvedValue({
      user: {
        username: "johndoe",
      },
      items: [{ id: validId, title: "Frontend Portfolio" }],
    } as never);

    const response = await request(app)
      .get("/u/@johndoe");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      user: {
        username: "johndoe",
      },
    });
    expect(response.body.data.items[0]).toMatchObject({
      id: validId,
      title: "Frontend Portfolio",
    });
    expect(typeof response.body.data.items[0].id).toBe("string");
  });

  it("returns 404 when the resource is not found", async () => {
    listByUsernameMock.mockRejectedValue(new ResponseError(404, "Portfolio tidak ditemukan"));
    const response = await request(app)
      .get("/u/@johndoe");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Portfolio tidak ditemukan ".trim());
  });

  it("supports users who have no public portfolio items yet", async () => {
    listByUsernameMock.mockResolvedValue({
      user: {
        username: "johndoe",
      },
      items: [],
    } as never);

    const response = await request(app)
      .get("/u/@johndoe");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body.data.user.username).toBe("johndoe");
    expect(response.body.data.items).toEqual([]);
  });
});
