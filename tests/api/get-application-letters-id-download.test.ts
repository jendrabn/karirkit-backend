import request from "supertest";
import {
  createRealApplicationLetterFixture,
  createRealTemplateFixture,
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
  loadPrisma,
} from "./real-mode";

const validId = "550e8400-e29b-41d4-a716-446655440000";

let app: typeof import("../../src/index").default;
let ApplicationLetterService: typeof import("../../src/services/application-letter.service").ApplicationLetterService;
let DownloadLogService: typeof import("../../src/services/download-log.service").DownloadLogService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/services/application-letter.service", () => ({
      ApplicationLetterService: {
        download: jest.fn(),
      },
    }));
    jest.doMock("../../src/services/download-log.service", () => ({
      DownloadLogService: {
        checkDownloadLimit: jest.fn(),
        logDownload: jest.fn(),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ ApplicationLetterService } = await import(
    "../../src/services/application-letter.service"
  ));
  ({ DownloadLogService } = await import("../../src/services/download-log.service"));
  ({ ResponseError: ResponseErrorClass } = await import(
    "../../src/utils/response-error.util"
  ));
});

afterAll(async () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    await disconnectPrisma();
  }
});

describe("GET /application-letters/:id/download", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("downloads an application letter document", async () => {
    const downloadMock = jest.mocked(ApplicationLetterService.download);
    const checkLimitMock = jest.mocked(DownloadLogService.checkDownloadLimit);
    const logDownloadMock = jest.mocked(DownloadLogService.logDownload);
    checkLimitMock.mockResolvedValue(undefined as never);
    logDownloadMock.mockResolvedValue(undefined as never);
    downloadMock.mockResolvedValue({
      fileName: "application-letter.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: Buffer.from("docx-content"),
    } as never);

    const response = await request(app)
      .get(`/application-letters/${validId}/download?format=docx`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    expect(response.headers["content-disposition"]).toContain("attachment;");
    expect(logDownloadMock).toHaveBeenCalledTimes(1);
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).get(
      `/application-letters/${validId}/download`
    );

    expect(response.status).toBe(401);
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns errors when the download format is not supported", async () => {
    const checkLimitMock = jest.mocked(DownloadLogService.checkDownloadLimit);
    const downloadMock = jest.mocked(ApplicationLetterService.download);
    checkLimitMock.mockResolvedValue(undefined as never);
    downloadMock.mockRejectedValue(
      new ResponseErrorClass(400, "Format unduhan tidak didukung")
    );

    const response = await request(app)
      .get(`/application-letters/${validId}/download?format=zip`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(400);
    expect(response.body.errors.general[0]).toBe("Format unduhan tidak didukung");
  });
});

describe("GET /application-letters/:id/download", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();
  const trackedTemplateIds = new Set<string>();
  const trackedLetterIds = new Set<string>();

  afterEach(async () => {
    const prisma = await loadPrisma();
    if (trackedLetterIds.size > 0) {
      await prisma.applicationLetter.deleteMany({
        where: { id: { in: [...trackedLetterIds] } },
      });
    }
    if (trackedTemplateIds.size > 0) {
      await prisma.template.deleteMany({
        where: { id: { in: [...trackedTemplateIds] } },
      });
    }
    await deleteUsersByEmail(...trackedEmails);
    trackedEmails.clear();
    trackedTemplateIds.clear();
    trackedLetterIds.clear();
  });

  it("downloads an application letter document", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("application-letter-download");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const template = await createRealTemplateFixture(
      "application_letter",
      "app-letter-download"
    );
    trackedTemplateIds.add(template.id);
    const letter = await createRealApplicationLetterFixture(user.id, template.id, {
      name: "Application Letter Download",
    });
    trackedLetterIds.add(letter.id);

    const response = await request(app)
      .get(`/application-letters/${letter.id}/download?format=docx`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    expect(response.headers["content-disposition"]).toContain("attachment;");
    expect(Number(response.headers["content-length"])).toBeGreaterThan(0);

    const logs = await prisma.downloadLog.findMany({
      where: { userId: user.id, documentId: letter.id },
    });
    expect(logs).toHaveLength(1);
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).get(
      `/application-letters/${validId}/download`
    );

    expect(response.status).toBe(401);
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns errors when the download format is not supported", async () => {
    const { user } = await createRealUser("application-letter-download-invalid");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const template = await createRealTemplateFixture(
      "application_letter",
      "app-letter-download-invalid"
    );
    trackedTemplateIds.add(template.id);
    const letter = await createRealApplicationLetterFixture(user.id, template.id);
    trackedLetterIds.add(letter.id);

    const response = await request(app)
      .get(`/application-letters/${letter.id}/download?format=zip`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Format unduhan tidak didukung");
  });
});
