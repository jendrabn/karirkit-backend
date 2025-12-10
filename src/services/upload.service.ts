import type { Express } from "express";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { ResponseError } from "../utils/response-error.util";

const TEMP_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "temp");
const DEFAULT_EXTENSION = ".bin";

export type TempUploadResult = {
  path: string;
  original_name: string;
  size: number;
  mime_type: string;
};

export class UploadService {
  static async uploadTempFile(
    userId: string,
    file?: Express.Multer.File
  ): Promise<TempUploadResult> {
    if (!file) {
      throw new ResponseError(400, "File is required");
    }

    await fs.mkdir(TEMP_UPLOAD_DIR, { recursive: true });

    const extension = UploadService.resolveExtension(file);
    const fileName = UploadService.buildFileName(userId, extension);
    const fullPath = path.join(TEMP_UPLOAD_DIR, fileName);

    await fs.writeFile(fullPath, file.buffer);

    const publicPath = path.posix.join("/uploads/temp", fileName);

    return {
      path: publicPath,
      original_name: file.originalname,
      size: file.size,
      mime_type: file.mimetype,
    };
  }

  private static resolveExtension(file: Express.Multer.File): string {
    const originalExt = path.extname(file.originalname || "").toLowerCase();

    if (UploadService.isSafeExtension(originalExt)) {
      return originalExt;
    }

    const fallback = UploadService.extensionFromMime(file.mimetype);
    return fallback ?? DEFAULT_EXTENSION;
  }

  private static isSafeExtension(extension: string): boolean {
    if (!extension) {
      return false;
    }
    // limit to reasonable characters to avoid path confusion
    return /^\.[a-z0-9]{1,8}$/i.test(extension);
  }

  private static extensionFromMime(mime: string): string | null {
    const normalized = mime.toLowerCase();
    const map: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/jpg": ".jpg",
      "image/png": ".png",
      "image/gif": ".gif",
      "image/webp": ".webp",
      "image/svg+xml": ".svg",
      "video/mp4": ".mp4",
      "video/quicktime": ".mov",
      "video/x-msvideo": ".avi",
      "video/x-matroska": ".mkv",
      "application/pdf": ".pdf",
      "application/msword": ".doc",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
      "application/vnd.ms-excel": ".xls",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
      "application/vnd.ms-powerpoint": ".ppt",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
      "text/plain": ".txt",
      "application/rtf": ".rtf",
    };

    return map[normalized] ?? null;
  }

  private static buildFileName(userId: string, extension: string): string {
    const uniqueSuffix = crypto.randomUUID();
    const userSegment = userId.replace(/[^a-zA-Z0-9]/g, "").slice(-12) || "anon";
    return `${Date.now()}-${userSegment}-${uniqueSuffix}${extension}`;
  }
}
