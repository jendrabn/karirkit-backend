import fs from "fs/promises";
import path from "path";
import request from "supertest";
import app from "../../src/index";

const publicDirectory = path.resolve(process.cwd(), "public");

describe("GET /uploads/* security", () => {
  const createdPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(
      createdPaths.map((filePath) =>
        fs.rm(filePath, { force: true }).catch(() => {
          // ignore cleanup errors
        })
      )
    );
    createdPaths.length = 0;
  });

  it("blocks direct public access to stored documents", async () => {
    const filePath = path.join(
      publicDirectory,
      "uploads",
      "documents",
      `private-${Date.now()}.txt`
    );
    createdPaths.push(filePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, "dokumen rahasia");

    const response = await request(app).get(
      `/uploads/documents/${path.basename(filePath)}`
    );

    expect(response.status).toBe(404);
    expect(response.body.errors.general[0]).toBe("File tidak ditemukan");
  });

  it("still serves non-document uploads from public storage", async () => {
    const filePath = path.join(
      publicDirectory,
      "uploads",
      "temp",
      `public-${Date.now()}.txt`
    );
    createdPaths.push(filePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, "file publik");

    const response = await request(app).get(
      `/uploads/temp/${path.basename(filePath)}`
    );

    expect(response.status).toBe(200);
    expect(response.text).toBe("file publik");
  });
});
