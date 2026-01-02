import type { Request, Response, NextFunction, Express } from "express";
import multer, { MulterError } from "multer";
import { ResponseError } from "../utils/response-error.util";

const MAX_TEMP_UPLOAD_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_BLOG_UPLOAD_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_DOCUMENT_UPLOAD_SIZE = 25 * 1024 * 1024; // 25 MB
const MAX_DOCUMENT_UPLOAD_COUNT = 20;
const documentMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "application/rtf",
]);

const isAllowedTempMime = (mime: string): boolean => {
  const normalized = mime.toLowerCase();
  return (
    normalized.startsWith("image/") ||
    normalized.startsWith("video/") ||
    documentMimeTypes.has(normalized)
  );
};

const tempUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_TEMP_UPLOAD_SIZE,
  },
  fileFilter: (_req, file, cb) => {
    if (isAllowedTempMime(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new ResponseError(400, "File must be an image, video, or document"));
  },
}).single("file");

const isAllowedDocumentMime = (mime: string): boolean => {
  const normalized = mime.toLowerCase();
  return normalized.startsWith("image/") || documentMimeTypes.has(normalized);
};

const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_DOCUMENT_UPLOAD_SIZE,
  },
  fileFilter: (_req, file, cb) => {
    if (isAllowedDocumentMime(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new ResponseError(400, "File must be an image or document"));
  },
}).any();

const createUploadMiddleware = (
  uploadFn: (req: Request, res: Response, cb: (err?: unknown) => void) => void,
  sizeLimitMessage: string
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    uploadFn(req, res, (err?: unknown) => {
      if (!err) {
        next();
        return;
      }

      if (err instanceof ResponseError) {
        next(err);
        return;
      }

      if (err instanceof MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          next(new ResponseError(400, sizeLimitMessage));
          return;
        }

        next(new ResponseError(400, err.message));
        return;
      }

      next(err as Error);
    });
  };
};

const blogUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_BLOG_UPLOAD_SIZE,
  },
  fileFilter: (_req, file, cb) => {
    if (isAllowedTempMime(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new ResponseError(400, "File must be an image, video, or document"));
  },
}).single("file");

export const handleTempUpload = createUploadMiddleware(
  tempUpload,
  "File size must be less than or equal to 10 MB"
);

export const handleBlogUpload = createUploadMiddleware(
  blogUpload,
  "File size must be less than or equal to 5 MB"
);

export const handleDocumentUpload = createUploadMiddleware(
  (req, res, cb) => {
    documentUpload(req, res, (err?: unknown) => {
      if (err) {
        cb(err);
        return;
      }

      const files = req.files;
      let totalFiles = 0;
      if (Array.isArray(files)) {
        totalFiles = files.length;
      } else if (files && typeof files === "object") {
        totalFiles = Object.values(
          files as Record<string, Express.Multer.File[]>
        ).reduce((sum, arr) => sum + (arr?.length ?? 0), 0);
      }

      if (totalFiles > MAX_DOCUMENT_UPLOAD_COUNT) {
        cb(new ResponseError(400, "Maksimal 20 file per unggahan"));
        return;
      }

      cb();
    });
  },
  "File size must be less than or equal to 25 MB"
);
