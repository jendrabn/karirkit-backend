import request from "supertest";

import app from "../../src/index";

describe("POST /auth/logout", () => {
  it("clears the session for authenticated users", async () => {
    const response = await request(app)
      .post("/auth/logout")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    expect(response.headers["set-cookie"]).toBeDefined();
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).post("/auth/logout");

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("allows admin sessions to be cleared with the same response shape", async () => {
    const response = await request(app)
      .post("/auth/logout")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
  });
});
