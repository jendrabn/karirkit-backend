import request from "supertest";
import {
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
} from "./real-mode";

let app: typeof import("../../src/index").default;

beforeAll(async () => {
  ({ default: app } = await import("../../src/index"));
});

afterAll(async () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    await disconnectPrisma();
  }
});

describe("POST /auth/logout", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
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

describe("POST /auth/logout", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();

  afterEach(async () => {
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
  });

  it("clears the session for authenticated users with a real JWT", async () => {
    const { user } = await createRealUser("logout-success");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .post("/auth/logout")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    expect(response.headers["set-cookie"]).toBeDefined();
    expect(response.headers["set-cookie"][0]).toContain("karirkit_session=");
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).post("/auth/logout");

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("allows admin sessions to be cleared with the same response shape", async () => {
    const { user } = await createRealUser("logout-admin", {
      role: "admin",
    });
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .post("/auth/logout")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    expect(response.headers["set-cookie"]).toBeDefined();
  });
});
