import request from "supertest";
import {
  createRealCvFixture,
  createRealTemplateFixture,
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
  loadPrisma,
} from "./real-mode";

const validId = "550e8400-e29b-41d4-a716-446655440000";

let app: typeof import("../../src/index").default;
let CvService: typeof import("../../src/services/cv.service").CvService;
let DownloadLogService: typeof import("../../src/services/download-log.service").DownloadLogService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
  jest.resetModules();
  if (!process.env.RUN_REAL_API_TESTS) {
    jest.doMock("../../src/config/prisma.config", () => ({
      prisma: {
        usageLog: {
          count: jest.fn().mockResolvedValue(0),
          create: jest.fn(),
        },
        user: {
          findUnique: jest.fn().mockResolvedValue({
            createdAt: new Date("2026-01-01"),
          }),
        },
        subscription: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
        cv: { count: jest.fn().mockResolvedValue(0) },
        document: { findMany: jest.fn().mockResolvedValue([]) },
      },
    }));
    jest.doMock("../../src/services/cv.service", () => ({
      CvService: {
        download: jest.fn(),
      },
    }));
    jest.doMock("../../src/services/download-log.service", () => ({
      DownloadLogService: {
        logDownload: jest.fn(),
      },
    }));
  } else {
    jest.doMock("docx-templates", () => ({
      __esModule: true,
      default: jest.fn().mockResolvedValue(Buffer.from("docx-content")),
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ CvService } = await import("../../src/services/cv.service"));
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

describe("GET /cvs/:id/download", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("downloads a CV document", async () => {
    const downloadMock = jest.mocked(CvService.download);
    const logDownloadMock = jest.mocked(DownloadLogService.logDownload);
    logDownloadMock.mockResolvedValue(undefined as never);
    downloadMock.mockResolvedValue({
      fileName: "resume.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: Buffer.from("docx-content"),
    } as never);

    const response = await request(app)
      .get(`/cvs/${validId}/download?format=docx`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    expect(response.headers["content-disposition"]).toContain("attachment;");
    expect(logDownloadMock).toHaveBeenCalledTimes(1);
    expect(logDownloadMock).toHaveBeenCalledWith(
      "user-1",
      "cv",
      validId,
      "resume.docx",
      "docx"
    );
  });

  it("logs download for PDF format", async () => {
    const downloadMock = jest.mocked(CvService.download);
    const logDownloadMock = jest.mocked(DownloadLogService.logDownload);
    logDownloadMock.mockResolvedValue(undefined as never);
    downloadMock.mockResolvedValue({
      fileName: "resume.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("pdf-content"),
    } as never);

    const response = await request(app)
      .get(`/cvs/${validId}/download?format=pdf`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(200);
    expect(logDownloadMock).toHaveBeenCalledWith(
      "user-1",
      "cv",
      validId,
      "resume.pdf",
      "pdf"
    );
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).get(`/cvs/${validId}/download`);

    expect(response.status).toBe(401);
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns errors when the requested format is invalid", async () => {
    const downloadMock = jest.mocked(CvService.download);
    downloadMock.mockRejectedValue(new ResponseErrorClass(400, "Format unduhan tidak didukung"));

    const response = await request(app)
      .get(`/cvs/${validId}/download?format=zip`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(400);
    expect(response.body.errors.general[0]).toBe("Format unduhan tidak didukung");
  });
});

describe("GET /cvs/:id/download", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();
  const trackedTemplateIds = new Set<string>();
  const trackedCvIds = new Set<string>();

  afterEach(async () => {
    const prisma = await loadPrisma();
    if (trackedCvIds.size > 0) {
      await prisma.cv.deleteMany({
        where: { id: { in: [...trackedCvIds] } },
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
    trackedCvIds.clear();
  });

  it("downloads a CV document", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("cv-download");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const template = await createRealTemplateFixture("cv", "cv-download");
    trackedTemplateIds.add(template.id);
    const cv = await createRealCvFixture(user.id, template.id, { name: "CV Download" });
    trackedCvIds.add(cv.id);

    const response = await request(app)
      .get(`/cvs/${cv.id}/download?format=docx`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    expect(response.headers["content-disposition"]).toContain("attachment;");
    expect(Number(response.headers["content-length"])).toBeGreaterThan(0);

    const logs = await prisma.usageLog.findMany({
      where: { userId: user.id, feature: "cv_download_docx" },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      userId: user.id,
      feature: "cv_download_docx",
    });
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).get(`/cvs/${validId}/download`);

    expect(response.status).toBe(401);
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns errors when the requested format is invalid", async () => {
    const { user } = await createRealUser("cv-download-invalid");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const template = await createRealTemplateFixture("cv", "cv-download-invalid");
    trackedTemplateIds.add(template.id);
    const cv = await createRealCvFixture(user.id, template.id);
    trackedCvIds.add(cv.id);

    const response = await request(app)
      .get(`/cvs/${cv.id}/download?format=zip`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Format unduhan tidak didukung");
  });
});
