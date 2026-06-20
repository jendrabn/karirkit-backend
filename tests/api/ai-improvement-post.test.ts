import request from "supertest";
import {
  buildApplicationLetterPayload,
  buildCvPayload,
} from "./real-mode";

let app: typeof import("../../src/index").default;
let env: typeof import("../../src/config/env.config").default;
let AiService: typeof import("../../src/services/ai.service").AiService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  jest.doMock("../../src/config/prisma.config", () => ({
    prisma: {},
  }));
  jest.doMock("../../src/services/ai.service", () => ({
    AiService: {
      checkAiUsageLimit: jest.fn(),
      improveCv: jest.fn(),
      improveApplicationLetter: jest.fn(),
      logAiUsage: jest.fn(),
    },
  }));

  ({ default: app } = await import("../../src/index"));
  ({ default: env } = await import("../../src/config/env.config"));
  ({ AiService } = await import("../../src/services/ai.service"));
  ({ ResponseError: ResponseErrorClass } = await import(
    "../../src/utils/response-error.util"
  ));
});

afterAll(() => {
  env.ai.enabled = false;
});

describe("POST /cvs/ai-improve", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    env.ai.enabled = true;
  });

  it("improves a cv payload", async () => {
    const payload = buildCvPayload("template-basic");
    const {
      photo: _photo,
      template_id: _templateId,
      visibility: _visibility,
      ...aiPayload
    } = payload;
    const improved = {
      ...aiPayload,
      headline: "Backend Engineer | TypeScript API Specialist",
    };

    jest.mocked(AiService.checkAiUsageLimit).mockResolvedValue(undefined);
    jest.mocked(AiService.improveCv).mockResolvedValue(improved as never);
    jest.mocked(AiService.logAiUsage).mockResolvedValue(undefined);

    const response = await request(app)
      .post("/cvs/ai-improve")
      .set("Authorization", "Bearer user-token")
      .send({
        data: payload,
        target_position: "Senior Backend Engineer",
        job_description: "Build scalable APIs with TypeScript.",
      });

    expect(response.status).toBe(200);
    expect(response.body.data.headline).toBe(
      "Backend Engineer | TypeScript API Specialist"
    );
    expect(response.body.meta.improvement_summary).toMatchObject({
      changed_fields_count: 1,
      summary: ["Headline diperbaiki."],
      changed_fields: [
        {
          path: "headline",
          label: "Headline",
          change_type: "updated",
        },
      ],
    });
    expect(AiService.checkAiUsageLimit).toHaveBeenCalledWith("user-1", "cv");
    expect(AiService.improveCv).toHaveBeenCalledWith(
      expect.not.objectContaining({
        photo: expect.anything(),
        template_id: expect.anything(),
        visibility: expect.anything(),
      }),
      "id",
      "Senior Backend Engineer",
      "Build scalable APIs with TypeScript."
    );
    expect(AiService.logAiUsage).toHaveBeenCalledWith("user-1", "cv");
  });

  it("returns 503 when AI improvement is disabled", async () => {
    env.ai.enabled = false;

    const response = await request(app)
      .post("/cvs/ai-improve")
      .set("Authorization", "Bearer user-token")
      .send({ data: buildCvPayload("template-basic") });

    expect(response.status).toBe(503);
    expect(response.body.errors.general[0]).toBe(
      "Fitur perbaikan AI sedang dinonaktifkan"
    );
    expect(response.body.code).toBe("AI_DISABLED");
    expect(AiService.improveCv).not.toHaveBeenCalled();
  });

  it("returns 429 when the daily AI limit is reached", async () => {
    jest.mocked(AiService.checkAiUsageLimit).mockRejectedValue(
      new ResponseErrorClass(
        429,
        "Batas perbaikan AI harian tercapai.",
        undefined,
        { code: "AI_LIMIT_REACHED" }
      )
    );

    const response = await request(app)
      .post("/cvs/ai-improve")
      .set("Authorization", "Bearer user-token")
      .send({ data: buildCvPayload("template-basic") });

    expect(response.status).toBe(429);
    expect(response.body.code).toBe("AI_LIMIT_REACHED");
    expect(AiService.improveCv).not.toHaveBeenCalled();
    expect(AiService.logAiUsage).not.toHaveBeenCalled();
  });
});

describe("POST /application-letters/ai-improve", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    env.ai.enabled = true;
  });

  it("improves an application letter payload", async () => {
    const payload = buildApplicationLetterPayload("template-basic");
    const {
      signature: _signature,
      template_id: _templateId,
      ...aiPayload
    } = payload;
    const improved = {
      ...aiPayload,
      subject: "Application for Backend Engineer Position",
    };

    jest.mocked(AiService.checkAiUsageLimit).mockResolvedValue(undefined);
    jest
      .mocked(AiService.improveApplicationLetter)
      .mockResolvedValue(improved as never);
    jest.mocked(AiService.logAiUsage).mockResolvedValue(undefined);

    const response = await request(app)
      .post("/application-letters/ai-improve")
      .set("Authorization", "Bearer user-token")
      .send({
        data: payload,
        target_position: "Backend Engineer",
      });

    expect(response.status).toBe(200);
    expect(response.body.data.subject).toBe(
      "Application for Backend Engineer Position"
    );
    expect(response.body.meta.improvement_summary).toMatchObject({
      changed_fields_count: 1,
      summary: ["Subjek diperbaiki."],
      changed_fields: [
        {
          path: "subject",
          label: "Subjek",
          change_type: "updated",
        },
      ],
    });
    expect(AiService.improveApplicationLetter).toHaveBeenCalledWith(
      expect.not.objectContaining({
        signature: expect.anything(),
        template_id: expect.anything(),
      }),
      "id",
      "Backend Engineer",
      undefined
    );
    expect(AiService.logAiUsage).toHaveBeenCalledWith(
      "user-1",
      "application_letter"
    );
  });
});
