import type { NextFunction, Request, Response } from "express";
import {
  DOCUMENT_COMPRESSION_LEVELS,
  DocumentCompressionLevel,
  DocumentService,
} from "../services/document.service";
import { sendSuccess } from "../utils/response-builder.util";
import { ResponseError } from "../utils/response-error.util";

export class DocumentController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await DocumentService.list(req.user!.id, req.query);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const files = DocumentController.extractFiles(req);
      if (files.length === 0) {
        throw new ResponseError(400, "File diperlukan");
      }

      const compression = DocumentController.parseCompression(
        req.query.compression,
      );

      const document = await (files.length > 1
        ? DocumentService.createMany(req.user!.id, req.body, files, compression)
        : DocumentService.create(
            req.user!.id,
            req.body,
            files[0],
            compression,
          ));

      sendSuccess(res, document as any, 201);
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await DocumentService.delete(req.user!.id, req.params.id as string);
      sendSuccess(res);
    } catch (error) {
      next(error);
    }
  }

  static async massDelete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await DocumentService.massDelete(req.user!.id, req.body);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async download(req: Request, res: Response, next: NextFunction) {
    try {
      const document = await DocumentService.download(
        req.user!.id,
        req.params.id as string,
      );

      res.setHeader("Content-Type", document.mimeType);
      res.setHeader(
        "Content-Disposition",
        DocumentController.buildContentDisposition(document.fileName),
      );
      res.send(document.buffer);
    } catch (error) {
      next(error);
    }
  }

  /** Supports a single `req.file`, `req.files` as an array, or grouped `file` / `file[]` fields. */
  private static extractFiles(req: Request): Express.Multer.File[] {
    if (req.file) {
      return [req.file as Express.Multer.File];
    }
    if (Array.isArray(req.files)) {
      return req.files as Express.Multer.File[];
    }

    const grouped = req.files as
      | Record<string, Express.Multer.File[]>
      | undefined;
    return [...(grouped?.file ?? []), ...(grouped?.["file[]"] ?? [])];
  }

  private static parseCompression(
    value: unknown,
  ): DocumentCompressionLevel | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    const raw = Array.isArray(value) && value.length > 0 ? value[0] : value;

    if (typeof raw !== "string") {
      throw new ResponseError(400, "Opsi kompresi tidak valid");
    }

    const normalized = raw.trim().toLowerCase();

    if (!normalized) {
      return undefined;
    }
    if (
      !DOCUMENT_COMPRESSION_LEVELS.includes(
        normalized as DocumentCompressionLevel,
      )
    ) {
      throw new ResponseError(
        400,
        `Opsi kompresi tidak dikenal. Pilihan: ${DOCUMENT_COMPRESSION_LEVELS.join(
          ", ",
        )}`,
      );
    }

    return normalized as DocumentCompressionLevel;
  }

  private static buildContentDisposition(fileName: string): string {
    const fallback = fileName
      .replace(/[\r\n]+/g, " ")
      .replace(/["\\]/g, "")
      .trim();
    const asciiSafe = fallback
      .replace(/[^\x20-\x7E]+/g, "")
      .replace(/[\s-]+/g, "_")
      .trim();
    const safeName = asciiSafe || "document";
    const encoded = encodeURIComponent(fileName);

    return `attachment; filename="${safeName}"; filename*=UTF-8''${encoded}`;
  }
}
