import request from "supertest";
import {
  createRealCoverLetterFixture,
  createRealTemplateFixture,
  createRealUser,
  createSessionToken,
  deleteUsersByEmail,
  disconnectPrisma,
  loadPrisma,
} from "./real-mode";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";

const validId = "550e8400-e29b-41d4-a716-446655440000";

let app: typeof import("../../src/index").default;
let CoverLetterService: typeof import("../../src/services/cover-letter.service").CoverLetterService;
let DownloadLogService: typeof import("../../src/services/download-log.service").DownloadLogService;
let ResponseErrorClass: typeof import("../../src/utils/response-error.util").ResponseError;

beforeAll(async () => {
if (process.env.RUN_REAL_API_TESTS !== "true") {
    mock.module("../../src/config/prisma.config", () => ({
      prisma: {
        usageLog: {
          count: mock(() => {}).mockResolvedValue(0),
          create: mock(() => {}),
        },
        user: {
          findUnique: mock(() => {}).mockResolvedValue({
            createdAt: new Date("2026-01-01"),
          }),
        },
        subscription: {
          findFirst: mock(() => {}).mockResolvedValue(null),
        },
        coverLetter: { count: mock(() => {}).mockResolvedValue(0) },
      },
    }));
    mock.module("../../src/services/cover-letter.service", () => ({
      CoverLetterService: {
        download: mock(() => {}),
      },
    }));
    mock.module("../../src/services/download-log.service", () => ({
      DownloadLogService: {
        logDownload: mock(() => {}),
      },
    }));
  }

  ({ default: app } = await import("../../src/index"));
  ({ CoverLetterService } = await import(
    "../../src/services/cover-letter.service"
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

describe("GET /cover-letters/:id/download", () => {
  if (process.env.RUN_REAL_API_TESTS === "true") {
    return;
  }
  beforeEach(() => {
    mock.clearAllMocks();
  });

  it("downloads a cover letter document", async () => {
    const downloadMock = CoverLetterService.download;
    const logDownloadMock = DownloadLogService.logDownload;
    logDownloadMock.mockResolvedValue(undefined as never);
    downloadMock.mockResolvedValue({
      fileName: "cover-letter.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: Buffer.from("docx-content"),
    } as never);

    const response = await request(app)
      .get(`/cover-letters/${validId}/download?format=docx`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    expect(response.headers["content-disposition"]).toContain("attachment;");
    expect(logDownloadMock).toHaveBeenCalledTimes(1);
    expect(logDownloadMock).toHaveBeenCalledWith(
      "user-1",
      "cover_letter",
      validId,
      "cover-letter.docx",
      "docx"
    );
  });

  it("logs download for PDF format", async () => {
    const downloadMock = CoverLetterService.download;
    const logDownloadMock = DownloadLogService.logDownload;
    logDownloadMock.mockResolvedValue(undefined as never);
    downloadMock.mockResolvedValue({
      fileName: "cover-letter.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("pdf-content"),
    } as never);

    const response = await request(app)
      .get(`/cover-letters/${validId}/download?format=pdf`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(200);
    expect(logDownloadMock).toHaveBeenCalledWith(
      "user-1",
      "cover_letter",
      validId,
      "cover-letter.pdf",
      "pdf"
    );
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).get(
      `/cover-letters/${validId}/download`
    );

    expect(response.status).toBe(401);
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns errors when the download format is not supported", async () => {
    const downloadMock = CoverLetterService.download;
    downloadMock.mockRejectedValue(
      new ResponseErrorClass(400, "Format unduhan tidak didukung")
    );

    const response = await request(app)
      .get(`/cover-letters/${validId}/download?format=zip`)
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(400);
    expect(response.body.errors.general[0]).toBe("Format unduhan tidak didukung");
  });
});

describe("GET /cover-letters/:id/download", () => {
  if (process.env.RUN_REAL_API_TESTS !== "true") {
    return;
  }
  const trackedEmails = new Set<string>();
  const trackedTemplateIds = new Set<string>();
  const trackedLetterIds = new Set<string>();

  afterEach(async () => {
    const prisma = await loadPrisma();
    if (trackedLetterIds.size > 0) {
      await prisma.coverLetter.deleteMany({
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

  it("downloads a cover letter document", async () => {
    const prisma = await loadPrisma();
    const { user } = await createRealUser("cover-letter-download");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const template = await createRealTemplateFixture(
      "cover_letter",
      "app-letter-download"
    );
    trackedTemplateIds.add(template.id);
    const letter = await createRealCoverLetterFixture(user.id, template.id, {
      name: "Cover Letter Download",
    });
    trackedLetterIds.add(letter.id);

    const response = await request(app)
      .get(`/cover-letters/${letter.id}/download?format=docx`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    expect(response.headers["content-disposition"]).toContain("attachment;");
    expect(Number(response.headers["content-length"])).toBeGreaterThan(0);

    const logs = await prisma.usageLog.findMany({
      where: { userId: user.id, feature: "cover_letter_download_docx" },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      userId: user.id,
      feature: "cover_letter_download_docx",
    });
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).get(
      `/cover-letters/${validId}/download`
    );

    expect(response.status).toBe(401);
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("returns errors when the download format is not supported", async () => {
    const { user } = await createRealUser("cover-letter-download-invalid");
    trackedEmails.add(user.email);
    const token = await createSessionToken(user);
    const template = await createRealTemplateFixture(
      "cover_letter",
      "app-letter-download-invalid"
    );
    trackedTemplateIds.add(template.id);
    const letter = await createRealCoverLetterFixture(user.id, template.id);
    trackedLetterIds.add(letter.id);

    const response = await request(app)
      .get(`/cover-letters/${letter.id}/download?format=zip`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors.general");
    expect(response.body.errors.general[0]).toBe("Format unduhan tidak didukung");
  });
});
