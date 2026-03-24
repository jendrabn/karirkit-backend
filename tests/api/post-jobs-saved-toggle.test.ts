import request from "supertest";

jest.mock("../../src/services/job.service", () => ({
  JobService: {
    toggleSavedJob: jest.fn(),
  },
}));

import app from "../../src/index";
import { JobService } from "../../src/services/job.service";

describe("POST /jobs/saved/toggle", () => {
  const toggleSavedJobMock = jest.mocked(JobService.toggleSavedJob);
  const validId = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("toggles a saved job for the authenticated user", async () => {
    toggleSavedJobMock.mockResolvedValue({
      id: validId,
      saved: true,
    } as never);

    const response = await request(app)
      .post("/jobs/saved/toggle")
      .set("Authorization", "Bearer user-token")
      .send({ id: validId });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: validId,
      saved: true,
    });
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).post("/jobs/saved/toggle").send({ id: validId });

    expect(response.status).toBe(401);
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 400 when the job id is not a valid UUID", async () => {
    const response = await request(app)
      .post("/jobs/saved/toggle")
      .set("Authorization", "Bearer user-token")
      .send({ id: "invalid-id" });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.id");
    expect(Array.isArray(response.body.errors.id)).toBe(true);
  });
});
