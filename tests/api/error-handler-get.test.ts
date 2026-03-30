import request from "supertest";

describe("Unhandled error responses", () => {
  it("does not expose internal server error messages", async () => {
    jest.resetModules();
    jest.doMock("../../src/controllers/health.controller", () => ({
      getHealth: () => {
        throw new Error("database credentials leaked");
      },
    }));

    const { default: app } = await import("../../src/index");
    const response = await request(app).get("/health");

    expect(response.status).toBe(500);
    expect(response.body.errors.general[0]).toBe("Internal Server Error");
    expect(JSON.stringify(response.body)).not.toContain("database credentials leaked");
  });
});
