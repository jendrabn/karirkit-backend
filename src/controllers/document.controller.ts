import type { NextFunction, Request, Response } from "express";
import { DocumentCompressionLevel, DocumentService } from "../services/document.service";
import { sendSuccess } from "../utils/response-builder.util";
import { ResponseError } from "../utils/response-error.util";

const COMPRESSION_OPTIONS: DocumentCompressionLevel[] = [
  "auto",
  "light",
  "medium",
  "strong",
];

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
      if (!req.file) {
        throw new ResponseError(400, "File diperlukan");
      }

      const compression = DocumentController.parseCompression(
        req.query.compression
      );

      const document = await DocumentService.create(
        req.user!.id,
        req.body,
        req.file,
        compression
      );

      sendSuccess(res, document, 201);
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await DocumentService.delete(req.user!.id, req.params.id);
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
        req.params.id
      );

      res.setHeader("Content-Type", document.mimeType);
      res.setHeader(
        "Content-Disposition",
        DocumentController.buildContentDisposition(document.fileName)
      );
      res.send(document.buffer);
    } catch (error) {
      next(error);
    }
  }

  private static parseCompression(
    value: unknown
  ): DocumentCompressionLevel | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    const raw =
      Array.isArray(value) && value.length > 0 ? value[0] : value;

    if (typeof raw !== "string") {
      throw new ResponseError(400, "Opsi kompresi tidak valid");
    }

    const normalized = raw.trim().toLowerCase();

    if (!normalized) {
      return undefined;
    }
    if (!COMPRESSION_OPTIONS.includes(normalized as DocumentCompressionLevel)) {
      throw new ResponseError(
        400,
        `Opsi kompresi tidak dikenal. Pilihan: ${COMPRESSION_OPTIONS.join(
          ", "
        )}`
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
