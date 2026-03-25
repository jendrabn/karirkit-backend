import type { Request, Response, NextFunction, Express } from "express";
import multer, { MulterError } from "multer";
import { ResponseError } from "../utils/response-error.util";
import { SystemSettingService } from "../services/system-setting.service";

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

const isAllowedDocumentMime = (mime: string): boolean => {
  const normalized = mime.toLowerCase();
  return normalized.startsWith("image/") || documentMimeTypes.has(normalized);
};

const handleUploadError = (
  err: unknown,
  next: NextFunction,
  sizeLimitMessage: string
): void => {
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
};

const createSingleUpload = (
  maxSizeBytes: number,
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => void
) =>
  multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: maxSizeBytes,
    },
    fileFilter,
  }).single("file");

const createAnyUpload = (
  maxSizeBytes: number,
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => void
) =>
  multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: maxSizeBytes,
    },
    fileFilter,
  }).any();

export const handleTempUpload = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const config = await SystemSettingService.getTempUploadConfig();
    if (!config.enabled) {
      next(new ResponseError(503, "Fitur upload sementara sedang dinonaktifkan"));
      return;
    }

    const upload = createSingleUpload(config.maxSizeBytes, (_req, file, cb) => {
      if (isAllowedTempMime(file.mimetype)) {
        cb(null, true);
        return;
      }
      cb(new ResponseError(400, "File must be an image, video, or document"));
    });

    upload(req, res, (err?: unknown) => {
      handleUploadError(
        err,
        next,
        `File size must be less than or equal to ${Math.floor(
          config.maxSizeBytes / (1024 * 1024)
        )} MB`
      );
    });
  } catch (error) {
    next(error as Error);
  }
};

export const handleBlogUpload = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const config = await SystemSettingService.getBlogUploadConfig();
    if (!config.enabled) {
      next(new ResponseError(503, "Fitur upload blog sedang dinonaktifkan"));
      return;
    }

    const upload = createSingleUpload(config.maxSizeBytes, (_req, file, cb) => {
      if (isAllowedTempMime(file.mimetype)) {
        cb(null, true);
        return;
      }
      cb(new ResponseError(400, "File must be an image, video, or document"));
    });

    upload(req, res, (err?: unknown) => {
      handleUploadError(
        err,
        next,
        `File size must be less than or equal to ${Math.floor(
          config.maxSizeBytes / (1024 * 1024)
        )} MB`
      );
    });
  } catch (error) {
    next(error as Error);
  }
};

export const handleDocumentUpload = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const config = await SystemSettingService.getDocumentUploadConfig();
    if (!config.enabled) {
      next(new ResponseError(503, "Fitur upload dokumen sedang dinonaktifkan"));
      return;
    }

    const upload = createAnyUpload(config.maxSizeBytes, (_req, file, cb) => {
      if (isAllowedDocumentMime(file.mimetype)) {
        cb(null, true);
        return;
      }
      cb(new ResponseError(400, "File must be an image or document"));
    });

    upload(req, res, (err?: unknown) => {
      if (!err) {
        const files = req.files;
        let totalFiles = 0;
        if (Array.isArray(files)) {
          totalFiles = files.length;
        } else if (files && typeof files === "object") {
          totalFiles = Object.values(
            files as Record<string, Express.Multer.File[]>
          ).reduce((sum, arr) => sum + (arr?.length ?? 0), 0);
        }

        if (totalFiles > config.maxFileCount) {
          next(
            new ResponseError(
              400,
              `Maksimal ${config.maxFileCount} file per unggahan`
            )
          );
          return;
        }
      }

      handleUploadError(
        err,
        next,
        `File size must be less than or equal to ${Math.floor(
          config.maxSizeBytes / (1024 * 1024)
        )} MB`
      );
    });
  } catch (error) {
    next(error as Error);
  }
};
