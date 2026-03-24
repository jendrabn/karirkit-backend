import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/account.service", () => ({
  AccountService: {
    changePassword: jest.fn(),
  },
}));

import app from "../../src/index";
import { AccountService } from "../../src/services/account.service";

describe("PUT /account/change-password", () => {
  const changePasswordMock = jest.mocked(AccountService.changePassword);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("changes the password for the authenticated user", async () => {
    changePasswordMock.mockResolvedValue(undefined as never);

    const response = await request(app)
      .put("/account/change-password")
      .set("Authorization", "Bearer user-token")
      .send({
        current_password: "secret123",
        new_password: "new-secret123",
        password_confirmation: "new-secret123",
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.message");
    expect(response.body.data.message).toBe("Password updated successfully");
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).put("/account/change-password").send({
      current_password: "secret123",
      new_password: "new-secret123",
    });

    expect(response.status).toBe(401);
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns validation errors when the old password is incorrect", async () => {
    changePasswordMock.mockRejectedValue(
      new ResponseError(400, "Password saat ini tidak sesuai"),
    );

    const response = await request(app)
      .put("/account/change-password")
      .set("Authorization", "Bearer user-token")
      .send({
        current_password: "wrong-password",
        new_password: "new-secret123",
        password_confirmation: "new-secret123",
      });

    expect(response.status).toBe(400);
    expect(response.body.errors.general[0]).toBe("Password saat ini tidak sesuai");
  });
});
