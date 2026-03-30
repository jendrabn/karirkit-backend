import request from "supertest";
import {
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
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
    expect(getTemplatesMock).toHaveBeenCalledWith({
      type: "cv",
      language: "id",
      planId: undefined,
    });
  });

  it("passes the authenticated plan into template filtering", async () => {
    const getTemplatesMock = jest.mocked(TemplateService.getTemplates);
    getTemplatesMock.mockResolvedValue([
      { id: "template-2", name: "Premium CV", type: "cv" },
    ] as never);

    const response = await request(app)
      .get("/templates?type=cv&language=id")
      .set("Authorization", "Bearer pro-token");

    expect(response.status).toBe(200);
    expect(getTemplatesMock).toHaveBeenCalledWith({
      type: "cv",
      language: "id",
      planId: "pro",
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
  const trackedEmails = new Set<string>();

  afterEach(async () => {
    const prisma = await loadPrisma();
    if (trackedTemplateIds.size > 0) {
      await prisma.template.deleteMany({
        where: { id: { in: [...trackedTemplateIds] } },
      });
    }
    trackedTemplateIds.clear();
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
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

  it("hides premium templates for guests and free users", async () => {
    const prisma = await loadPrisma();
    const suffix = Date.now();
    const freeTemplate = await prisma.template.create({
      data: {
        name: `Free CV ${suffix}`,
        type: "cv",
        language: "id",
        path: `/uploads/templates/free-template-${suffix}.docx`,
        preview: `/uploads/templates/free-template-${suffix}.png`,
        isPremium: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const premiumTemplate = await prisma.template.create({
      data: {
        name: `Premium CV ${suffix}`,
        type: "cv",
        language: "id",
        path: `/uploads/templates/premium-template-${suffix}.docx`,
        preview: `/uploads/templates/premium-template-${suffix}.png`,
        isPremium: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedTemplateIds.add(freeTemplate.id);
    trackedTemplateIds.add(premiumTemplate.id);

    const guestResponse = await request(app).get("/templates?type=cv&language=id");
    expect(guestResponse.status).toBe(200);
    expect(
      guestResponse.body.data.items.some(
        (item: { id: string }) => item.id === premiumTemplate.id,
      ),
    ).toBe(false);
    expect(
      guestResponse.body.data.items.some(
        (item: { id: string }) => item.id === freeTemplate.id,
      ),
    ).toBe(true);

    const { user } = await createRealUser("templates-free-plan", {
      planId: "free",
    });
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const freeResponse = await request(app)
      .get("/templates?type=cv&language=id")
      .set("Authorization", `Bearer ${token}`);

    expect(freeResponse.status).toBe(200);
    expect(
      freeResponse.body.data.items.some(
        (item: { id: string }) => item.id === premiumTemplate.id,
      ),
    ).toBe(false);
  });

  it("returns premium templates for users whose plan allows them", async () => {
    const prisma = await loadPrisma();
    const suffix = Date.now();
    const premiumTemplate = await prisma.template.create({
      data: {
        name: `Premium Letter ${suffix}`,
        type: "application_letter",
        language: "id",
        path: `/uploads/templates/premium-letter-${suffix}.docx`,
        preview: `/uploads/templates/premium-letter-${suffix}.png`,
        isPremium: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    trackedTemplateIds.add(premiumTemplate.id);

    const { user } = await createRealUser("templates-pro-plan", {
      planId: "pro",
    });
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);

    const response = await request(app)
      .get("/templates?type=application_letter&language=id")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(
      response.body.data.items.some(
        (item: { id: string }) => item.id === premiumTemplate.id,
      ),
    ).toBe(true);
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
