import request from "supertest";

jest.mock("../../src/services/document.service", () => ({
  DocumentService: {
    create: jest.fn(),
    createMany: jest.fn(),
    createMerged: jest.fn(),
  },
}));

import app from "../../src/index";
import { DocumentService } from "../../src/services/document.service";

describe("POST /documents", () => {
  const createMock = jest.mocked(DocumentService.create);
  const createManyMock = jest.mocked(DocumentService.createMany);
  const createMergedMock = jest.mocked(DocumentService.createMerged);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uploads a single document for the authenticated user", async () => {
    createMock.mockResolvedValue({
      id: "document-1",
      file_name: "resume.pdf",
    } as never);

    const response = await request(app)
      .post("/documents")
      .set("Authorization", "Bearer user-token")
      .attach("file", Buffer.from("fake-pdf"), {
        filename: "resume.pdf",
        contentType: "application/pdf",
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toMatchObject({
      id: "document-1",
      file_name: "resume.pdf",
    });
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const response = await request(app).post("/documents");

    expect(response.status).toBe(401);
    expect(response.body.errors.general[0]).toBe("Unauthenticated");
  });

  it("merges multiple uploaded documents when merge is enabled", async () => {
    createMergedMock.mockResolvedValue({
      id: "document-merged",
      file_name: "merged.pdf",
    } as never);

    const response = await request(app)
      .post("/documents?merge=true")
      .set("Authorization", "Bearer user-token")
      .attach("files", Buffer.from("fake-pdf-1"), {
        filename: "resume-1.pdf",
        contentType: "application/pdf",
      })
      .attach("files", Buffer.from("fake-pdf-2"), {
        filename: "resume-2.pdf",
        contentType: "application/pdf",
      });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      id: "document-merged",
      file_name: "merged.pdf",
    });
    expect(createMergedMock).toHaveBeenCalledTimes(1);
    expect(createManyMock).not.toHaveBeenCalled();
  });
});
