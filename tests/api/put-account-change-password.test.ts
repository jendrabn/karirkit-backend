import request from "supertest";
import {
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
} from "./real-mode";

let app: typeof import("../../src/index").default;
let AccountService: typeof import("../../src/services/account.service").AccountService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/account.service", () => ({
      AccountService: {
        changePassword: jest.fn(),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ AccountService } = await import("../../src/services/account.service"));
  ({ ResponseError: ResponseErrorClass } = await import(
    "../../src/utils/response-error.util"
  ));
});

afterAll(async () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    await disconnectPrisma();
  }
});

describe("PUT /account/change-password", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("changes the password for the authenticated user", async () => {
    const changePasswordMock = jest.mocked(AccountService.changePassword);
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
    const changePasswordMock = jest.mocked(AccountService.changePassword);
    changePasswordMock.mockRejectedValue(
      new ResponseErrorClass(400, "Password saat ini tidak sesuai"),
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

describe("PUT /account/change-password", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();

  afterEach(async () => {
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("changes the password and allows login with the new credentials", async () => {
    const { user, plainPassword } = await createRealUser("change-password-success");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const newPassword = "new-secret123";

    const response = await request(app)
      .put("/account/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({
        current_password: plainPassword,
        new_password: newPassword,
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.message");
    expect(response.body.data.message).toBe("Password updated successfully");

    const loginResponse = await request(app).post("/auth/login").send({
      identifier: user.email,
      password: newPassword,
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body).toHaveProperty("data.id", user.id);
    expect(loginResponse.headers["set-cookie"]).toBeDefined();
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).put("/account/change-password").send({
      current_password: "secret123",
      new_password: "new-secret123",
    });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("rejects when the new password matches the current password", async () => {
    const { user, plainPassword } = await createRealUser("change-password-same");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .put("/account/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({
        current_password: plainPassword,
        new_password: plainPassword,
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe(
      "Kata sandi baru harus berbeda dengan kata sandi saat ini",
    );
  });
});
