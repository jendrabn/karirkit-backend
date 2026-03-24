import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/application.service", () => ({
  ApplicationService: {
    list: jest.fn(),
  },
}));

import app from "../../src/index";
import { ApplicationService } from "../../src/services/application.service";

const validId = "550e8400-e29b-41d4-a716-446655440000";

describe("GET /applications", () => {
  const listMock = jest.mocked(ApplicationService.list);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a paginated application list", async () => {
    listMock.mockResolvedValue({
      items: [{ id: validId, name: "Application 1" }],
      meta: { page: 1, per_page: 20, total: 1 },
    } as never);

    const response = await request(app)
      .get("/applications").set("Authorization", "Bearer user-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body).toHaveProperty("data.meta");
    expect(Array.isArray(response.body.data.items)).toBe(true);
    expect(response.body.data.items[0]).toMatchObject({ id: validId, name: "Application 1" });
    expect(typeof response.body.data.meta.total).toBe("number");
  });

  it("returns 401 when the request is unauthenticated", async () => {
    
    const response = await request(app)
      .get("/applications");

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("supports an empty application state", async () => {
    listMock.mockResolvedValue({ items: [], meta: { page: 1, per_page: 20, total: 0 } } as never);

    const response = await request(app)
      .get("/applications").set("Authorization", "Bearer user-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(response.body.data.items).toEqual([]);
    expect(response.body.data.meta.total).toBe(0);
  });
});
