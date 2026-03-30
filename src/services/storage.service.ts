import fs from "fs/promises";
import path from "path";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import env from "../config/env.config";
import { ResponseError } from "../utils/response-error.util";

const PUBLIC_ROOT = path.join(process.cwd(), "public");
const UPLOADS_PREFIX = "uploads";
const PRIVATE_UPLOAD_PREFIXES = ["uploads/documents"];

type StoredFile = {
  buffer: Buffer;
  contentType: string | null;
};

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  ".avi": "video/x-msvideo",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".json": "application/json",
  ".mkv": "video/x-matroska",
  ".mov": "video/quicktime",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".rtf": "application/rtf",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".xls": "application/vnd.ms-excel",
  ".xlsx":
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const normalizePublicPath = (publicPath: string): string => {
  const trimmed = publicPath.trim();
  if (!trimmed) {
    throw new ResponseError(400, "Path file tidak valid");
  }

  const normalizedInput = trimmed.replace(/\\/g, "/").replace(/^\/+/, "");
  const safeInput = path.normalize(normalizedInput);
  if (safeInput.startsWith("..") || path.isAbsolute(safeInput)) {
    throw new ResponseError(400, "Path file tidak valid");
  }

  const posixPath = safeInput.replace(/\\/g, "/");
  return `/${posixPath}`;
};

const normalizeUploadsPath = (publicPath: string): string => {
  const normalized = normalizePublicPath(publicPath);
  const withoutLeadingSlash = normalized.replace(/^\/+/, "").toLowerCase();
  if (
    withoutLeadingSlash !== UPLOADS_PREFIX &&
    !withoutLeadingSlash.startsWith(`${UPLOADS_PREFIX}/`)
  ) {
    throw new ResponseError(400, "Path file tidak valid");
  }

  return normalized;
};

const getContentType = (
  explicitContentType?: string | null,
  publicPath?: string
): string | null => {
  if (explicitContentType?.trim()) {
    return explicitContentType.trim();
  }

  if (!publicPath) {
    return null;
  }

  const extension = path.extname(publicPath).toLowerCase();
  return CONTENT_TYPE_BY_EXTENSION[extension] ?? null;
};

let s3Client: S3Client | null = null;

const getS3Client = (): S3Client => {
  if (s3Client) {
    return s3Client;
  }

  if (!env.storage.bucket) {
    throw new Error("Missing required environment variable: STORAGE_BUCKET");
  }

  if (!env.storage.accessKeyId || !env.storage.secretAccessKey) {
    throw new Error(
      "Missing required environment variable: STORAGE_ACCESS_KEY_ID or STORAGE_SECRET_ACCESS_KEY"
    );
  }

  s3Client = new S3Client({
    region: env.storage.region,
    endpoint: env.storage.endpoint,
    forcePathStyle: env.storage.forcePathStyle,
    credentials: {
      accessKeyId: env.storage.accessKeyId,
      secretAccessKey: env.storage.secretAccessKey,
    },
  });

  return s3Client;
};

const getObjectKey = (publicPath: string): string => {
  return normalizeUploadsPath(publicPath).replace(/^\/+/, "");
};

const getLocalAbsolutePath = (publicPath: string): string => {
  const normalized = normalizePublicPath(publicPath).replace(/^\/+/, "");
  return path.join(PUBLIC_ROOT, normalized);
};

const isUploadsPath = (publicPath: string): boolean => {
  const normalized = normalizePublicPath(publicPath).replace(/^\/+/, "").toLowerCase();
  return (
    normalized === UPLOADS_PREFIX ||
    normalized.startsWith(`${UPLOADS_PREFIX}/`)
  );
};

const isPrivateUploadPath = (publicPath: string): boolean => {
  const normalized = normalizeUploadsPath(publicPath)
    .replace(/^\/+/, "")
    .toLowerCase();

  return PRIVATE_UPLOAD_PREFIXES.some(
    (prefix) =>
      normalized === prefix || normalized.startsWith(`${prefix}/`)
  );
};

export class StorageService {
  static isCloudStorage(): boolean {
    return env.storage.driver === "s3";
  }

  static normalizeUploadsPath(publicPath?: string | null): string | null {
    if (!publicPath) {
      return null;
    }

    const trimmed = publicPath.trim();
    if (!trimmed) {
      return null;
    }

    try {
      return normalizeUploadsPath(trimmed);
    } catch {
      return null;
    }
  }

  static isPrivateUploadPath(publicPath?: string | null): boolean {
    if (!publicPath) {
      return false;
    }

    const trimmed = publicPath.trim();
    if (!trimmed) {
      return false;
    }

    try {
      return isPrivateUploadPath(trimmed);
    } catch {
      return false;
    }
  }

  static async write(
    publicPath: string,
    buffer: Buffer,
    contentType?: string | null
  ): Promise<void> {
    const normalizedPath = normalizeUploadsPath(publicPath);
    const normalizedContentType = getContentType(contentType, normalizedPath);

    if (!StorageService.isCloudStorage()) {
      const absolutePath = getLocalAbsolutePath(normalizedPath);
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, buffer);
      return;
    }

    const client = getS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: env.storage.bucket,
        Key: getObjectKey(normalizedPath),
        Body: buffer,
        ContentType: normalizedContentType ?? undefined,
      })
    );
  }

  static async read(publicPath: string): Promise<StoredFile> {
    const normalizedPath = normalizePublicPath(publicPath);

    if (!StorageService.isCloudStorage() || !isUploadsPath(normalizedPath)) {
      const absolutePath = getLocalAbsolutePath(normalizedPath);
      return {
        buffer: await fs.readFile(absolutePath),
        contentType: getContentType(undefined, normalizedPath),
      };
    }

    const client = getS3Client();
    const output = await client.send(
      new GetObjectCommand({
        Bucket: env.storage.bucket,
        Key: getObjectKey(normalizedPath),
      })
    );

    const bytes = await output.Body?.transformToByteArray();
    if (!bytes) {
      throw new ResponseError(404, "File tidak ditemukan");
    }

    return {
      buffer: Buffer.from(bytes),
      contentType: output.ContentType ?? getContentType(undefined, normalizedPath),
    };
  }

  static async delete(publicPath: string): Promise<void> {
    const normalizedPath = normalizeUploadsPath(publicPath);

    if (!StorageService.isCloudStorage()) {
      const absolutePath = getLocalAbsolutePath(normalizedPath);
      try {
        await fs.unlink(absolutePath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          throw error;
        }
      }
      return;
    }

    const client = getS3Client();
    await client.send(
      new DeleteObjectCommand({
        Bucket: env.storage.bucket,
        Key: getObjectKey(normalizedPath),
      })
    );
  }

  static async copy(sourcePublicPath: string, destinationPublicPath: string) {
    const normalizedSource = normalizeUploadsPath(sourcePublicPath);
    const normalizedDestination = normalizeUploadsPath(destinationPublicPath);

    if (!StorageService.isCloudStorage()) {
      const source = getLocalAbsolutePath(normalizedSource);
      const destination = getLocalAbsolutePath(normalizedDestination);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.copyFile(source, destination);
      return;
    }

    const client = getS3Client();
    const sourceKey = getObjectKey(normalizedSource)
      .split("/")
      .map(encodeURIComponent)
      .join("/");

    await client.send(
      new CopyObjectCommand({
        Bucket: env.storage.bucket,
        Key: getObjectKey(normalizedDestination),
        CopySource: `${env.storage.bucket}/${sourceKey}`,
      })
    );
  }

  static async move(sourcePublicPath: string, destinationPublicPath: string) {
    const normalizedSource = normalizeUploadsPath(sourcePublicPath);
    const normalizedDestination = normalizeUploadsPath(destinationPublicPath);

    if (!StorageService.isCloudStorage()) {
      const source = getLocalAbsolutePath(normalizedSource);
      const destination = getLocalAbsolutePath(normalizedDestination);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.rename(source, destination);
      return;
    }

    await StorageService.copy(normalizedSource, normalizedDestination);
    await StorageService.delete(normalizedSource);
  }
}
