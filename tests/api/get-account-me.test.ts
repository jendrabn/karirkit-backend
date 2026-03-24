import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/account.service", () => ({
  AccountService: {
    me: jest.fn(),
  },
}));

import app from "../../src/index";
import { AccountService } from "../../src/services/account.service";

describe("GET /account/me", () => {
  const meMock = jest.mocked(AccountService.me);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the authenticated account profile", async () => {
    meMock.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      username: "user",
    } as never);

    const response = await request(app)
      .get("/account/me")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: "user-1",
      email: "user@example.com",
      username: "user",
    });
    expect(typeof response.body.data.id).toBe("string");
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).get("/account/me");

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("propagates service errors when the account cannot be loaded", async () => {
    meMock.mockRejectedValue(new ResponseError(404, "Akun tidak ditemukan"));

    const response = await request(app)
      .get("/account/me")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(404);
    expect(response.body.errors.general[0]).toBe("Akun tidak ditemukan");
  });
});
