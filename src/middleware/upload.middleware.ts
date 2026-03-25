import type { Request, Response, NextFunction, Express } from "express";
import multer, { MulterError } from "multer";
import { ResponseError } from "../utils/response-error.util";
import { SystemSettingService } from "../services/system-setting.service";
import {
  ALL_VERIFIED_UPLOAD_MIME_TYPES,
  VERIFIED_UPLOAD_MIME_TYPES,
  applyVerifiedMimeType,
} from "../utils/file-signature.util";

const documentMimeTypes = new Set<string>(VERIFIED_UPLOAD_MIME_TYPES.document);

const isAllowedTempMime = (mime: string): boolean => {
  const normalized = mime.toLowerCase();
  return (
    VERIFIED_UPLOAD_MIME_TYPES.image.includes(
      normalized as (typeof VERIFIED_UPLOAD_MIME_TYPES.image)[number]
    ) ||
    VERIFIED_UPLOAD_MIME_TYPES.video.includes(
      normalized as (typeof VERIFIED_UPLOAD_MIME_TYPES.video)[number]
    ) ||
    documentMimeTypes.has(normalized)
  );
};

const isAllowedDocumentMime = (mime: string): boolean => {
  const normalized = mime.toLowerCase();
  return (
    VERIFIED_UPLOAD_MIME_TYPES.image.includes(
      normalized as (typeof VERIFIED_UPLOAD_MIME_TYPES.image)[number]
    ) || documentMimeTypes.has(normalized)
  );
};

const validateUploadedFiles = (
  files: Express.Multer.File[],
  allowMime: (mime: string) => boolean,
  errorMessage: string
): void => {
  for (const file of files) {
    const detectedMimeType = applyVerifiedMimeType(file);
    if (!detectedMimeType || !allowMime(detectedMimeType)) {
      throw new ResponseError(400, errorMessage);
    }
  }
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
    if (err.code === "LIMIT_FILE_COUNT") {
      next(new ResponseError(400, "Jumlah file melebihi batas unggahan"));
      return;
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      next(new ResponseError(400, "Field file tidak valid"));
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
  maxFileCount: number,
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => void
) =>
  multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: maxSizeBytes,
      files: maxFileCount,
    },
    fileFilter,
  }).fields([
    { name: "file", maxCount: 1 },
    { name: "files", maxCount: maxFileCount },
  ]);

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
      if (ALL_VERIFIED_UPLOAD_MIME_TYPES.includes(file.mimetype.toLowerCase() as any)) {
        cb(null, true);
        return;
      }
      cb(new ResponseError(400, "File must be an image, video, or document"));
    });

    upload(req, res, (err?: unknown) => {
      if (!err && req.file) {
        try {
          validateUploadedFiles(
            [req.file],
            isAllowedTempMime,
            "File harus berupa gambar, video, atau dokumen yang valid"
          );
        } catch (validationError) {
          handleUploadError(validationError, next, "");
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
      if (ALL_VERIFIED_UPLOAD_MIME_TYPES.includes(file.mimetype.toLowerCase() as any)) {
        cb(null, true);
        return;
      }
      cb(new ResponseError(400, "File must be an image, video, or document"));
    });

    upload(req, res, (err?: unknown) => {
      if (!err && req.file) {
        try {
          validateUploadedFiles(
            [req.file],
            isAllowedTempMime,
            "File harus berupa gambar, video, atau dokumen yang valid"
          );
        } catch (validationError) {
          handleUploadError(validationError, next, "");
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

    const upload = createAnyUpload(
      config.maxSizeBytes,
      config.maxFileCount,
      (_req, file, cb) => {
        if (ALL_VERIFIED_UPLOAD_MIME_TYPES.includes(file.mimetype.toLowerCase() as any)) {
          cb(null, true);
          return;
        }
        cb(new ResponseError(400, "File must be an image or document"));
      }
    );

    upload(req, res, (err?: unknown) => {
      if (!err) {
        const files = [
          ...(((req.files as Record<string, Express.Multer.File[]>)?.file ?? []) as Express.Multer.File[]),
          ...(((req.files as Record<string, Express.Multer.File[]>)?.files ?? []) as Express.Multer.File[]),
        ];

        try {
          validateUploadedFiles(
            files,
            isAllowedDocumentMime,
            "File harus berupa gambar atau dokumen yang valid"
          );
        } catch (validationError) {
          handleUploadError(validationError, next, "");
          return;
        }

        if (files.length > config.maxFileCount) {
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
