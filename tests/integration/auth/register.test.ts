import { afterEach, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";
import app from "../../../src/index";
import { AuthService, type SafeUser } from "../../../src/services/auth.service";
import { ResponseError } from "../../../src/utils/response-error.util";

jest.mock("../../../src/queues/email.queue", () => ({
  __esModule: true,
  enqueueEmail: jest.fn(),
  default: {
    add: jest.fn(),
    process: jest.fn(),
    on: jest.fn(),
  },
}));

describe("POST /auth/register", () => {
  const endpoint = "/auth/register";
  const basePayload = {
    name: "John Doe",
    username: "johnnydoe",
    email: "john@example.com",
    password: "secret123",
    phone: "+6281234567890",
  };

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it("returns 201 with user payload when registration succeeds", async () => {
    const safeUser: SafeUser = {
      id: "user-123",
      name: basePayload.name,
      username: basePayload.username,
      email: basePayload.email,
      phone: basePayload.phone,
      role: "user",
      avatar: null,
      googleId: null,
      createdAt: null,
      updatedAt: null,
      deletedAt: null,
    };

    const registerSpy = jest
      .spyOn(AuthService, "register")
      .mockResolvedValue(safeUser);

    const response = await request(app)
      .post(endpoint)
      .send(basePayload)
      .expect(201);

    expect(response.body).toEqual({ data: safeUser });
    expect(registerSpy).toHaveBeenCalledWith(basePayload);
  });

  it("returns 400 when request payload is invalid", async () => {
    const response = await request(app)
      .post(endpoint)
      .send({ name: "Jo" }) // missing required fields
      .expect(400);

    expect(response.body.errors).toBeDefined();
  });

  it("bubbles up service validation errors", async () => {
    const registerSpy = jest
      .spyOn(AuthService, "register")
      .mockRejectedValue(new ResponseError(400, "Email already exists"));

    const response = await request(app)
      .post(endpoint)
      .send(basePayload)
      .expect(400);

    expect(response.body.errors.general).toContain("Email already exists");
    expect(registerSpy).toHaveBeenCalledWith(basePayload);
  });
});
