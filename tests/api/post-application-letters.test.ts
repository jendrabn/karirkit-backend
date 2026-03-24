import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/application-letter.service", () => ({
  ApplicationLetterService: {
    create: jest.fn(),
  },
}));

import app from "../../src/index";
import { ApplicationLetterService } from "../../src/services/application-letter.service";

describe("POST /application-letters", () => {
  const createMock = jest.mocked(ApplicationLetterService.create);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a application letter record", async () => {
    createMock.mockResolvedValue({ id: "550e8400-e29b-41d4-a716-446655440000", name: "Application Letter Baru" } as never);

    const response = await request(app)
      .post("/application-letters").set("Authorization", "Bearer user-token")
      .send({ name: "Application Letter Baru" });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({ id: "550e8400-e29b-41d4-a716-446655440000", name: "Application Letter Baru" });
    expect(typeof response.body.data.id).toBe("string");
  });

  it("returns 401 when authentication is missing", async () => {
    const response = await request(app)
      .post("/application-letters")
      .send({ name: "Application Letter Baru" });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns validation errors for invalid payloads", async () => {
    createMock.mockRejectedValue(new ResponseError(400, "Payload tidak valid"));

    const response = await request(app)
      .post("/application-letters").set("Authorization", "Bearer user-token")
      .send({ name: "" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Payload tidak valid");
  });
});
