import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/application.service", () => ({
  ApplicationService: {
    getStats: jest.fn(),
  },
}));

import app from "../../src/index";
import { ApplicationService } from "../../src/services/application.service";

describe("GET /applications/stats", () => {
  const getStatsMock = jest.mocked(ApplicationService.getStats);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns application statistics", async () => {
    getStatsMock.mockResolvedValue({ total: 4, accepted: 2, rejected: 1 } as never);

    const response = await request(app)
      .get("/applications/stats").set("Authorization", "Bearer user-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({ total: 4, accepted: 2, rejected: 1 });
    expect(typeof response.body.data.total).toBe("number");
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).get("/applications/stats");

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("supports zero-value application statistics", async () => {
    getStatsMock.mockResolvedValue({ total: 0, accepted: 0, rejected: 0 } as never);

    const response = await request(app)
      .get("/applications/stats").set("Authorization", "Bearer user-token");

    expect(response.status).toBe(200);
    expect(response.body.data.total).toBe(0);
    expect(response.body.data.accepted).toBe(0);
  });
});
