import crypto from "crypto";
import { execFile } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";
import env from "../config/env.config";
import { ResponseError } from "./response-error.util";

const execFileAsync = promisify(execFile);

export const convertDocxToPdf = async (
  docxBuffer: Buffer,
  baseName: string
): Promise<Buffer> => {
  const safeName =
    baseName
      ?.replace(/[<>:"/\\|?*]+/g, "")
      .replace(/[\s-]+/g, "_")
      .trim() || "document";

  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "docx-to-pdf-" + crypto.randomUUID())
  );
  const inputPath = path.join(tempDir, `${safeName}.docx`);
  const outputPath = path.join(tempDir, `${safeName}.pdf`);

  try {
    await fs.writeFile(inputPath, docxBuffer);

    const args = [
      "--headless",
      "--convert-to",
      "pdf",
      "--outdir",
      tempDir,
      inputPath,
    ];

    await execFileAsync(env.libreOfficeCommand, args, { timeout: 120_000 });

    return await fs.readFile(outputPath);
  } catch (error) {
    console.error("Failed to convert DOCX to PDF:", error);
    throw new ResponseError(500, "Gagal mengonversi dokumen ke PDF");
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
};
