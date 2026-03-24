import request from "supertest";

jest.mock("../../src/services/job.service", () => ({
  JobService: {
    massDeleteSavedJobs: jest.fn(),
  },
}));

import app from "../../src/index";
import { JobService } from "../../src/services/job.service";

describe("DELETE /jobs/saved/mass-delete", () => {
  const massDeleteSavedJobsMock = jest.mocked(JobService.massDeleteSavedJobs);
  const validId = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deletes multiple saved jobs", async () => {
    massDeleteSavedJobsMock.mockResolvedValue({
      deleted_count: 1,
      ids: [validId],
    } as never);

    const response = await request(app)
      .delete("/jobs/saved/mass-delete")
      .set("Authorization", "Bearer user-token")
      .send({ ids: [validId] });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      deleted_count: 1,
      ids: [validId],
    });
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).delete("/jobs/saved/mass-delete").send({ ids: [validId] });

    expect(response.status).toBe(401);
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns 400 when the ids payload is empty", async () => {
    const response = await request(app)
      .delete("/jobs/saved/mass-delete")
      .set("Authorization", "Bearer user-token")
      .send({ ids: [] });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.ids");
    expect(Array.isArray(response.body.errors.ids)).toBe(true);
  });
});
