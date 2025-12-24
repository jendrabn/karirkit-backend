import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { ResponseError } from "../utils/response-error.util";

// Allowed file types
const ALLOWED_MIME_TYPES = {
  image: [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
  ],
  video: [
    "video/mp4",
    "video/quicktime",
    "video/x-msvideo",
    "video/x-matroska",
  ],
  document: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
    "application/rtf",
  ],
};

// MIME type to extension mapping
const MIME_TYPE_TO_EXTENSION: Record<string, string> = {
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
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.ms-powerpoint": ".ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    ".pptx",
  "text/plain": ".txt",
  "application/rtf": ".rtf",
};

export type UploadFileResult = {
  path: string;
  original_name: string;
  size: number;
  mime_type: string;
};

export class UploadService {
  static async uploadFile(
    file: Express.Multer.File,
    directory: string = "uploads/temp",
    options: {
      quality?: number; // 25-100, default: 50
      webp?: boolean; // true/false, default: true
      format?: string; // e.g. "jpg,png,docx"
    } = {}
  ): Promise<UploadFileResult> {
    // Validate file exists
    if (!file) {
      throw new ResponseError(400, "File diperlukan");
    }

    // Set default options
    const quality = Math.min(100, Math.max(25, options.quality || 50));
    const webp = options.webp !== undefined ? options.webp : true;

    // Validation 1: Check if file type is allowed (image, video, document)
    const allAllowedMimeTypes = [
      ...ALLOWED_MIME_TYPES.image,
      ...ALLOWED_MIME_TYPES.video,
      ...ALLOWED_MIME_TYPES.document,
    ];

    if (!allAllowedMimeTypes.includes(file.mimetype.toLowerCase())) {
      throw new ResponseError(
        400,
        "Jenis file tidak diperbolehkan. Hanya file gambar, video, dan dokumen yang diperbolehkan."
      );
    }

    // Validation 2: Check if file format matches the requested format
    if (options.format) {
      const allowedFormats = options.format
        .split(",")
        .map((f) => f.trim().toLowerCase());
      const fileExtension = path
        .extname(file.originalname)
        .toLowerCase()
        .substring(1);

      if (!allowedFormats.includes(fileExtension)) {
        throw new ResponseError(
          400,
          `Format file tidak sesuai. Format yang diperbolehkan: ${allowedFormats.join(
            ", "
          )}`
        );
      }
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
      throw new ResponseError(400, "Ukuran file tidak boleh lebih dari 10MB");
    }

    // Process the file
    let processedBuffer = file.buffer;
    let finalMimeType = file.mimetype;
    let extension =
      MIME_TYPE_TO_EXTENSION[file.mimetype] || path.extname(file.originalname);

    // Process image if applicable
    if (ALLOWED_MIME_TYPES.image.includes(file.mimetype.toLowerCase())) {
      try {
        if (webp) {
          processedBuffer = await sharp(file.buffer)
            .webp({ quality })
            .toBuffer();
          finalMimeType = "image/webp";
          extension = ".webp";
        } else if (
          file.mimetype.toLowerCase() === "image/jpeg" ||
          file.mimetype.toLowerCase() === "image/jpg"
        ) {
          processedBuffer = await sharp(file.buffer)
            .jpeg({ quality })
            .toBuffer();
        }
      } catch (error) {
        console.error("Error processing image:", error);
        // If processing fails, use the original buffer
      }
    }

    // Create directory if it doesn't exist
    const uploadDir = path.join(process.cwd(), "public", directory);
    await fs.mkdir(uploadDir, { recursive: true });

    // Generate filename with timestamp + UUID
    const timestamp = Date.now();
    const uuid = crypto.randomUUID();
    const filename = `${timestamp}-${uuid}${extension}`;
    const filePath = path.join(uploadDir, filename);

    // Write file to disk
    await fs.writeFile(filePath, processedBuffer);

    // Return public path
    const publicPath = path.posix.join("/", directory, filename);

    return {
      path: publicPath,
      original_name: file.originalname,
      size: processedBuffer.length,
      mime_type: finalMimeType,
    };
  }

  static async moveFromTemp(
    destinationDirectory: string,
    filePath?: string
  ): Promise<string> {
    if (!filePath) {
      throw new ResponseError(400, "FilePath diperlukan");
    }

    const fileName = path.basename(filePath);

    const sourcePath = path.join(process.cwd(), "public", filePath);

    const destDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      destinationDirectory
    );
    await fs.mkdir(destDir, { recursive: true });

    const finalPath = path.join(destDir, fileName);

    await fs.rename(sourcePath, finalPath);

    return path.posix.join("/uploads", destinationDirectory, fileName);
  }
}
