import request from "supertest";
import {
  disconnectPrisma,
  loadPrisma,
} from "./real-mode";

let app: typeof import("../../src/index").default;
let TemplateService: typeof import("../../src/services/template.service").TemplateService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/template.service", () => ({
      TemplateService: {
        getTemplates: jest.fn(),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ TemplateService } = await import("../../src/services/template.service"));
  ({ ResponseError: ResponseErrorClass } = await import(
    "../../src/utils/response-error.util"
  ));
});

afterAll(async () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    await disconnectPrisma();
  }
});

describe("GET /templates", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns public templates inside the items wrapper", async () => {
    const getTemplatesMock = jest.mocked(TemplateService.getTemplates);
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
    const getTemplatesMock = jest.mocked(TemplateService.getTemplates);
    getTemplatesMock.mockRejectedValue(
      new ResponseErrorClass(400, "Filter template tidak valid"),
    );

    const response = await request(app).get("/templates?type=unknown");

    expect(response.status).toBe(400);
    expect(response.body.errors.general[0]).toBe("Filter template tidak valid");
  });

  it("supports an empty template collection", async () => {
    const getTemplatesMock = jest.mocked(TemplateService.getTemplates);
    getTemplatesMock.mockResolvedValue([] as never);

    const response = await request(app).get("/templates");

    expect(response.status).toBe(200);
    expect(response.body.data.items).toEqual([]);
  });
});

describe("GET /templates", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedTemplateIds = new Set<string>();

  afterEach(async () => {
    const prisma = await loadPrisma();
    if (trackedTemplateIds.size > 0) {
      await prisma.template.deleteMany({
        where: { id: { in: [...trackedTemplateIds] } },
      });
    }
    trackedTemplateIds.clear();
  });

  it("returns public templates inside the items wrapper", async () => {
    const prisma = await loadPrisma();
    const template = await prisma.template.create({
      data: {
        name: `Modern CV ${Date.now()}`,
        type: "cv",
        language: "id",
        path: `/uploads/templates/public-template-${Date.now()}.docx`,
        preview: `/uploads/templates/public-template-${Date.now()}.png`,
        isPremium: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedTemplateIds.add(template.id);

    const response = await request(app).get("/templates?type=cv&language=id");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data.items");
    const matched = response.body.data.items.find(
      (item: { id: string }) => item.id === template.id,
    );
    expect(matched).toMatchObject({
      id: template.id,
      name: template.name,
      type: "cv",
      language: "id",
    });
  });

  it("returns validation errors when the template query is invalid", async () => {
    const response = await request(app).get("/templates?type=unknown");

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.type");
    expect(Array.isArray(response.body.errors.type)).toBe(true);
  });

  it("supports an empty template collection", async () => {
    const response = await request(app).get("/templates?type=cv&language=en");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data.items)).toBe(true);
  });
});
