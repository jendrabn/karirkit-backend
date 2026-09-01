import request from "supertest";
import { beforeAll, describe, expect, it } from "bun:test";

let app: typeof import("../../src/index").default;

beforeAll(async () => {
  ({ default: app } = await import("../../src/index"));
});

describe("GET /health", () => {
  it("returns service health information", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      environment: "test",
    });
    expect(typeof response.body.data.uptime).toBe("number");
    expect(typeof response.body.data.timestamp).toBe("string");
  });

  it("returns 404 for an invalid nested health route", async () => {
    const response = await request(app).get("/health/check");

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Route /health/check not found");
  });

  it("keeps a stable response shape across repeated requests", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      data: {
        environment: "test",
      },
    });
    expect(response.body.data.timestamp).toEqual(expect.any(String));
  });
});
