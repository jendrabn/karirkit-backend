import type { Request, Response, NextFunction, Express } from "express";
import multer, { MulterError } from "multer";
import env from "../config/env.config";
import { ResponseError } from "../utils/response-error.util";
import {
  ALL_VERIFIED_UPLOAD_MIME_TYPES,
  VERIFIED_UPLOAD_MIME_TYPES,
  applyVerifiedMimeType,
} from "../utils/file-signature.util";

const TEMP_UPLOAD_MAX_SIZE_BYTES = 10 * 1024 * 1024;
const BLOG_UPLOAD_MAX_SIZE_BYTES = 5 * 1024 * 1024;
const DOCUMENT_UPLOAD_MAX_FILE_COUNT = 20;

const documentMimeTypes = new Set<string>(VERIFIED_UPLOAD_MIME_TYPES.document);
const imageMimeTypes = new Set<string>(VERIFIED_UPLOAD_MIME_TYPES.image);
const videoMimeTypes = new Set<string>(VERIFIED_UPLOAD_MIME_TYPES.video);
const audioMimeTypes = new Set<string>(VERIFIED_UPLOAD_MIME_TYPES.audio);
const DOCUMENT_UPLOAD_MAX_SIZE_BYTES = env.documentUploadMaxSizeBytes;

const isAllowedTempMime = (mime: string): boolean => {
  const normalized = mime.toLowerCase();
  return (
    (imageMimeTypes.has(normalized) && normalized !== "image/svg+xml") ||
    videoMimeTypes.has(normalized) ||
    documentMimeTypes.has(normalized)
  );
};

const isAllowedDocumentMime = (mime: string): boolean => {
  const normalized = mime.toLowerCase();
  return (
    imageMimeTypes.has(normalized) ||
    documentMimeTypes.has(normalized) ||
    videoMimeTypes.has(normalized) ||
    audioMimeTypes.has(normalized)
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
      next(
        new ResponseError(
          400,
          "Field file tidak valid. Gunakan file atau file[]"
        )
      );
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
    { name: "file[]", maxCount: maxFileCount },
  ]);

export const handleTempUpload = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const upload = createSingleUpload(TEMP_UPLOAD_MAX_SIZE_BYTES, (_req, file, cb) => {
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
          TEMP_UPLOAD_MAX_SIZE_BYTES / (1024 * 1024)
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
    const upload = createSingleUpload(BLOG_UPLOAD_MAX_SIZE_BYTES, (_req, file, cb) => {
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
          BLOG_UPLOAD_MAX_SIZE_BYTES / (1024 * 1024)
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
    const upload = createAnyUpload(
      DOCUMENT_UPLOAD_MAX_SIZE_BYTES,
      DOCUMENT_UPLOAD_MAX_FILE_COUNT,
      (_req, file, cb) => {
        if (ALL_VERIFIED_UPLOAD_MIME_TYPES.includes(file.mimetype.toLowerCase() as any)) {
          cb(null, true);
          return;
        }
        cb(
          new ResponseError(
            400,
            "File harus berupa gambar, PDF, Microsoft Office, video, atau suara"
          )
        );
      }
    );

    upload(req, res, (err?: unknown) => {
      if (!err) {
        const groupedFiles = req.files as
          | Record<string, Express.Multer.File[]>
          | undefined;
        const singleFiles = (groupedFiles?.file ?? []) as Express.Multer.File[];
        const multipleFiles = (groupedFiles?.["file[]"] ??
          []) as Express.Multer.File[];

        if (singleFiles.length > 0 && multipleFiles.length > 0) {
          next(
            new ResponseError(
              400,
              "Gunakan salah satu field file atau file[], tidak keduanya"
            )
          );
          return;
        }

        const files = [
          ...singleFiles,
          ...multipleFiles,
        ];

        try {
          validateUploadedFiles(
            files,
            isAllowedDocumentMime,
            "File harus berupa gambar, PDF, Microsoft Office, video, atau suara yang valid"
          );
        } catch (validationError) {
          handleUploadError(validationError, next, "");
          return;
        }

        if (files.length > DOCUMENT_UPLOAD_MAX_FILE_COUNT) {
          next(
            new ResponseError(
              400,
              `Maksimal ${DOCUMENT_UPLOAD_MAX_FILE_COUNT} file per unggahan`
            )
          );
          return;
        }
      }

      handleUploadError(
        err,
        next,
        `Ukuran file tidak boleh lebih dari ${Math.floor(
          DOCUMENT_UPLOAD_MAX_SIZE_BYTES / (1024 * 1024)
        )}MB`
      );
    });
  } catch (error) {
    next(error as Error);
  }
};
