import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { ResponseError } from "../utils/response-error.util";
import { isHttpUrl } from "../utils/url.util";

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

const PUBLIC_ROOT = path.join(process.cwd(), "public");
const UPLOADS_ROOT = path.join(PUBLIC_ROOT, "uploads");
const TEMP_UPLOAD_PREFIX = "uploads/temp";

export type UploadFileResult = {
  path: string;
  original_name: string;
  size: number;
  mime_type: string;
};

export class UploadService {
  static isTempUploadPath(filePath?: string | null): boolean {
    return Boolean(
      UploadService.resolveUploadPath(filePath, [TEMP_UPLOAD_PREFIX])
    );
  }

  static async uploadFile(
    file: Express.Multer.File,
    directory: string = "uploads/temp",
    options: {
      quality?: number; // 25-100, default: 50
      webp?: boolean; // true/false, default: true
      format?: string; // e.g. "jpg,png,docx"
      maxSize?: number; // maximum allowed file size in bytes
      compressImage?: boolean; // disable image re-encoding when set to false
    } = {}
  ): Promise<UploadFileResult> {
    // Validate file exists
    if (!file) {
      throw new ResponseError(400, "File diperlukan");
    }

    // Set default options
    const qualityOption = options.quality;
    const quality =
      typeof qualityOption === "number"
        ? Math.min(100, Math.max(25, qualityOption))
        : undefined;
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

    // Validate file size (max 10MB by default)
    const maxSize = options.maxSize ?? 10 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new ResponseError(400, "Ukuran file tidak boleh lebih dari 10MB");
    }

    // Process the file
    let processedBuffer = file.buffer;
    let finalMimeType = file.mimetype;
    let extension =
      MIME_TYPE_TO_EXTENSION[file.mimetype] || path.extname(file.originalname);

    // Process image if applicable
    const normalizedMime = file.mimetype.toLowerCase();
    const compressImage = options.compressImage !== false;
    const shouldProcessImage =
      compressImage && ALLOWED_MIME_TYPES.image.includes(normalizedMime);

    if (shouldProcessImage) {
      try {
        if (webp) {
          processedBuffer = await sharp(file.buffer)
            .webp({ quality })
            .toBuffer();
          finalMimeType = "image/webp";
          extension = ".webp";
        } else if (
          (normalizedMime === "image/jpeg" || normalizedMime === "image/jpg") &&
          quality !== undefined
        ) {
          processedBuffer = await sharp(file.buffer)
            .jpeg({ quality })
            .toBuffer();
        } else if (normalizedMime === "image/png" && quality !== undefined) {
          const pngQuality = Math.min(100, Math.max(1, quality));
          processedBuffer = await sharp(file.buffer)
            .png({ quality: pngQuality })
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

    const trimmed = filePath.trim();
    if (!trimmed) {
      throw new ResponseError(400, "FilePath diperlukan");
    }

    if (isHttpUrl(trimmed)) {
      return trimmed;
    }

    const source = UploadService.resolveUploadPath(trimmed, [TEMP_UPLOAD_PREFIX]);
    if (!source) {
      throw new ResponseError(
        400,
        "File harus berasal dari folder upload sementara"
      );
    }

    const fileName = path.basename(source.relativePath);
    const safeDestinationDirectory =
      UploadService.normalizeUploadDirectory(destinationDirectory);
    const destDir = path.join(UPLOADS_ROOT, safeDestinationDirectory);
    await fs.mkdir(destDir, { recursive: true });

    const finalPath = path.join(destDir, fileName);

    try {
      await fs.rename(source.absolutePath, finalPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new ResponseError(400, "File upload sementara tidak ditemukan");
      }
      throw error;
    }

    return path.posix.join("/uploads", safeDestinationDirectory, fileName);
  }

  static async deleteUpload(
    filePath?: string | null,
    allowedPrefixes?: string[]
  ): Promise<void> {
    if (!filePath || isHttpUrl(filePath)) {
      return;
    }

    const resolved = UploadService.resolveUploadPath(filePath, allowedPrefixes);
    if (!resolved) {
      return;
    }

    try {
      await fs.unlink(resolved.absolutePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  static async copyUpload(
    filePath: string,
    destinationDirectory: string,
    allowedPrefixes?: string[]
  ): Promise<string> {
    if (isHttpUrl(filePath)) {
      return filePath;
    }

    const source = UploadService.resolveUploadPath(filePath, allowedPrefixes);
    if (!source) {
      throw new ResponseError(400, "File sumber tidak valid");
    }

    const extension = path.extname(source.relativePath);
    const safeDestinationDirectory =
      UploadService.normalizeUploadDirectory(destinationDirectory);
    const destinationRoot = path.join(UPLOADS_ROOT, safeDestinationDirectory);
    await fs.mkdir(destinationRoot, { recursive: true });

    const filename = `${Date.now()}-${crypto.randomUUID()}${extension}`;
    const destination = path.join(destinationRoot, filename);

    try {
      await fs.copyFile(source.absolutePath, destination);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new ResponseError(400, "File sumber tidak ditemukan");
      }
      throw error;
    }

    return path.posix.join("/uploads", safeDestinationDirectory, filename);
  }

  private static normalizeUploadDirectory(directory: string): string {
    const normalized = directory
      .trim()
      .replace(/\\/g, "/")
      .replace(/^\/+/, "")
      .replace(/\/+$/, "");

    if (!normalized) {
      throw new ResponseError(400, "Direktori upload tidak valid");
    }

    const safeDirectory = path.normalize(normalized);
    if (safeDirectory.startsWith("..") || path.isAbsolute(safeDirectory)) {
      throw new ResponseError(400, "Direktori upload tidak valid");
    }

    return safeDirectory.replace(/\\/g, "/");
  }

  private static resolveUploadPath(
    filePath?: string | null,
    allowedPrefixes?: string[]
  ):
    | {
        absolutePath: string;
        relativePath: string;
        publicPath: string;
      }
    | null {
    if (!filePath) {
      return null;
    }

    const trimmed = filePath.trim();
    if (!trimmed) {
      return null;
    }

    const normalizedInput = trimmed.replace(/\\/g, "/").replace(/^\/+/, "");
    const safeInput = path.normalize(normalizedInput);
    if (safeInput.startsWith("..") || path.isAbsolute(safeInput)) {
      return null;
    }

    const posixSafeInput = safeInput.replace(/\\/g, "/");
    const normalizedPrefixes = (allowedPrefixes?.length
      ? allowedPrefixes
      : ["uploads"]
    ).map((prefix) =>
      prefix
        .replace(/\\/g, "/")
        .replace(/^\/+/, "")
        .replace(/\/+$/, "")
        .toLowerCase()
    );

    const matchedPrefix = normalizedPrefixes.find((prefix) => {
      return (
        posixSafeInput.toLowerCase() === prefix ||
        posixSafeInput.toLowerCase().startsWith(`${prefix}/`)
      );
    });

    if (!matchedPrefix || posixSafeInput.toLowerCase() === matchedPrefix) {
      return null;
    }

    const absolutePath = path.join(PUBLIC_ROOT, safeInput);
    const relativeToUploads = path.relative(UPLOADS_ROOT, absolutePath);
    if (
      !relativeToUploads ||
      relativeToUploads.startsWith("..") ||
      path.isAbsolute(relativeToUploads)
    ) {
      return null;
    }

    return {
      absolutePath,
      relativePath: relativeToUploads.replace(/\\/g, "/"),
      publicPath: `/${posixSafeInput}`,
    };
  }
}
