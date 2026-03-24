import request from "supertest";

import { ResponseError } from "../../src/utils/response-error.util";

jest.mock("../../src/services/template.service", () => ({
  TemplateService: {
    getTemplates: jest.fn(),
  },
}));

import app from "../../src/index";
import { TemplateService } from "../../src/services/template.service";

describe("GET /templates", () => {
  const getTemplatesMock = jest.mocked(TemplateService.getTemplates);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns public templates inside the items wrapper", async () => {
    getTemplatesMock.mockResolvedValue([
      { id: "template-1", name: "Modern CV", type: "cv" },
    ] as never);

    const response = await request(app).get("/templates?type=cv&language=id");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    expect(Array.isArray(response.body.data.items)).toBe(true);
    expect(response.body.data.items[0]).toMatchObject({
      id: "template-1",
      name: "Modern CV",
      type: "cv",
    });
  });

  it("returns validation errors when the template query is invalid", async () => {
    getTemplatesMock.mockRejectedValue(new ResponseError(400, "Filter template tidak valid"));

    const response = await request(app).get("/templates?type=unknown");

    expect(response.status).toBe(400);
    expect(response.body.errors.general[0]).toBe("Filter template tidak valid");
  });

  it("supports an empty template collection", async () => {
    getTemplatesMock.mockResolvedValue([] as never);

    const response = await request(app).get("/templates");

    expect(response.status).toBe(200);
    expect(response.body.data.items).toEqual([]);
  });
});
