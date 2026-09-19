import { Request, Response, NextFunction } from "express";
import { CoverLetterService } from "../services/cover-letter.service";
import { sendSuccess } from "../utils/response-builder.util";
import { DownloadLogService } from "../services/download-log.service";
import { ResponseError } from "../utils/response-error.util";

export class CoverLetterController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await CoverLetterService.list(
        req.user!.id,
        req.query
      );
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async get(req: Request, res: Response, next: NextFunction) {
    try {
      const letter = await CoverLetterService.get(
        req.user!.id,
        req.params.id as string
      );
      sendSuccess(res, letter);
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const letter = await CoverLetterService.create(
        req.user!.id,
        req.body
      );
      sendSuccess(res, letter, 201);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const letter = await CoverLetterService.update(
        req.user!.id,
        req.params.id as string,
        req.body
      );
      sendSuccess(res, letter);
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await CoverLetterService.delete(req.user!.id, req.params.id as string);
      sendSuccess(res);
    } catch (error) {
      next(error);
    }
  }

  static async duplicate(req: Request, res: Response, next: NextFunction) {
    try {
      const letter = await CoverLetterService.duplicate(
        req.user!.id,
        req.params.id as string
      );
      sendSuccess(res, letter, 201);
    } catch (error) {
      next(error);
    }
  }

  static async download(req: Request, res: Response, next: NextFunction) {
    try {
      const rawFormat = Array.isArray(req.query.format)
        ? req.query.format[0]
        : req.query.format;
      const format = CoverLetterController.normalizeDownloadFormat(
        typeof rawFormat === "string" ? rawFormat : undefined
      );

      const document = await CoverLetterService.download(
        req.user!.id,
        req.params.id as string,
        format
      );

      await DownloadLogService.logDownload(
        req.user!.id,
        "cover_letter",
        req.params.id as string,
        document.fileName,
        format
      );

      res.setHeader("Content-Type", document.mimeType);
      res.setHeader(
        "Content-Disposition",
        CoverLetterController.buildContentDisposition(document.fileName)
      );
      res.send(document.buffer);
    } catch (error) {
      next(error);
    }
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
    const safeName = asciiSafe || "cover-letter";
    const encoded = encodeURIComponent(fileName);

    return `attachment; filename="${safeName}"; filename*=UTF-8''${encoded}`;
  }

  private static normalizeDownloadFormat(format?: string): "docx" | "pdf" {
    const normalized = (format ?? "docx").trim().toLowerCase();
    if (normalized === "docx" || normalized === "pdf") {
      return normalized;
    }

    throw new ResponseError(400, "Format unduhan tidak didukung");
  }

  static async massDelete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await CoverLetterService.massDelete(
        req.user!.id,
        req.body
      );
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
}
