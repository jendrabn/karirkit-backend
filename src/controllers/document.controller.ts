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
      const filesFromMulter =
        (req.files as Express.Multer.File[]) ||
        ((req.files as Record<string, Express.Multer.File[]>)?.files ?? []);
      const singleFile =
        (req.file as Express.Multer.File | undefined) ||
        ((req.files as Record<string, Express.Multer.File[]>)?.file?.[0] ??
          undefined);
      const files: Express.Multer.File[] = [];
      if (Array.isArray(filesFromMulter)) {
        files.push(...filesFromMulter);
      }
      if (singleFile) {
        files.push(singleFile);
      }
      if (files.length === 0) {
        throw new ResponseError(400, "File diperlukan");
      }

      const compression = DocumentController.parseCompression(
        req.query.compression
      );
      const merge = DocumentController.parseMergeFlag(req.query.merge);

      const document = await (merge && files.length > 1
        ? DocumentService.createMerged(
            req.user!.id,
            req.body,
            files,
            compression
          )
        : files.length > 1
        ? DocumentService.createMany(
            req.user!.id,
            req.body,
            files,
            compression
          )
        : DocumentService.create(
            req.user!.id,
            req.body,
            files[0],
            compression
          ));

      sendSuccess(res, document as any, 201);
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

  private static parseMergeFlag(value: unknown): boolean {
    if (value === undefined || value === null) {
      return false;
    }

    const raw = Array.isArray(value) ? value[0] : value;
    if (typeof raw === "boolean") {
      return raw;
    }

    if (typeof raw !== "string") {
      throw new ResponseError(400, "Opsi merge tidak valid");
    }

    const normalized = raw.trim().toLowerCase();
    if (["1", "true", "yes"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no", ""].includes(normalized)) {
      return false;
    }

    throw new ResponseError(400, "Opsi merge tidak dikenal");
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
