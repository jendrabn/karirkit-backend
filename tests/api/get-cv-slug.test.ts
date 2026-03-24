import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/cv.service", () => ({
  CvService: {
    getPublicBySlug: jest.fn(),
  },
}));

import app from "../../src/index";
import { CvService } from "../../src/services/cv.service";

describe("GET /cv/:slug", () => {
  const getPublicBySlugMock = jest.mocked(CvService.getPublicBySlug);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the public CV payload for a visible slug", async () => {
    getPublicBySlugMock.mockResolvedValue({
      slug: "public-cv",
      name: "User Resume",
    } as never);

    const response = await request(app).get("/cv/public-cv");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      slug: "public-cv",
      name: "User Resume",
    });
  });

  it("returns 404 when the CV slug does not exist", async () => {
    getPublicBySlugMock.mockRejectedValue(new ResponseError(404, "CV publik tidak ditemukan"));

    const response = await request(app).get("/cv/missing-cv");

    expect(response.status).toBe(404);
    expect(response.body.errors.general[0]).toBe("CV publik tidak ditemukan");
  });

  it("returns 404 when the CV is not public anymore", async () => {
    getPublicBySlugMock.mockRejectedValue(new ResponseError(404, "CV tidak tersedia"));

    const response = await request(app).get("/cv/hidden-cv");

    expect(response.status).toBe(404);
    expect(response.body.errors.general[0]).toBe("CV tidak tersedia");
  });
});
