import request from "supertest";

jest.mock("../../src/config/prisma.config", () => ({
  prisma: {
    user: { count: jest.fn() },
    cv: { count: jest.fn() },
    applicationLetter: { count: jest.fn() },
    application: { count: jest.fn() },
    template: { count: jest.fn() },
  },
}));

import app from "../../src/index";
import { prisma } from "../../src/config/prisma.config";

describe("GET /stats", () => {
  const prismaMock = prisma as unknown as {
    user: { count: jest.Mock };
    cv: { count: jest.Mock };
    applicationLetter: { count: jest.Mock };
    application: { count: jest.Mock };
    template: { count: jest.Mock };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns aggregated public statistics", async () => {
    prismaMock.user.count.mockResolvedValue(10);
    prismaMock.cv.count.mockResolvedValue(7);
    prismaMock.applicationLetter.count.mockResolvedValue(4);
    prismaMock.application.count.mockResolvedValue(12);
    prismaMock.template.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2);

    const response = await request(app).get("/stats");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      total_users: 10,
      total_cvs: 7,
      total_application_letters: 4,
      total_applications: 12,
      total_cv_templates: 3,
      total_application_letter_templates: 2,
    });
    expect(typeof response.body.data.total_users).toBe("number");
  });

  it("returns 500 when one of the counters fails", async () => {
    prismaMock.user.count.mockRejectedValue(new Error("Database unavailable"));

    const response = await request(app).get("/stats");

    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Database unavailable");
  });

  it("supports zero-value counters", async () => {
    prismaMock.user.count.mockResolvedValue(0);
    prismaMock.cv.count.mockResolvedValue(0);
    prismaMock.applicationLetter.count.mockResolvedValue(0);
    prismaMock.application.count.mockResolvedValue(0);
    prismaMock.template.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    const response = await request(app).get("/stats");

    expect(response.status).toBe(200);
    expect(response.body.data.total_users).toBe(0);
    expect(response.body.data.total_cv_templates).toBe(0);
  });
});
