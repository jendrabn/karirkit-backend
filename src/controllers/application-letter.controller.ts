import { Request, Response, NextFunction } from "express";
import { ApplicationLetterService } from "../services/application-letter.service";
import { sendSuccess } from "../utils/response-builder.util";
import { DownloadLogService } from "../services/download-log.service";
import { DownloadType } from "../generated/prisma/client";

export class ApplicationLetterController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ApplicationLetterService.list(
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
      const letter = await ApplicationLetterService.get(
        req.user!.id,
        req.params.id
      );
      sendSuccess(res, letter);
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const letter = await ApplicationLetterService.create(
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
      const letter = await ApplicationLetterService.update(
        req.user!.id,
        req.params.id,
        req.body
      );
      sendSuccess(res, letter);
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await ApplicationLetterService.delete(req.user!.id, req.params.id);
      sendSuccess(res);
    } catch (error) {
      next(error);
    }
  }

  static async duplicate(req: Request, res: Response, next: NextFunction) {
    try {
      const letter = await ApplicationLetterService.duplicate(
        req.user!.id,
        req.params.id
      );
      sendSuccess(res, letter, 201);
    } catch (error) {
      next(error);
    }
  }

  static async download(req: Request, res: Response, next: NextFunction) {
    try {
      await DownloadLogService.checkDownloadLimit(req.user!.id);
      const document = await ApplicationLetterService.generateDocx(
        req.user!.id,
        req.params.id
      );

      await DownloadLogService.logDownload(
        req.user!.id,
        DownloadType.application_letter,
        req.params.id,
        document.fileName
      );

      res.setHeader("Content-Type", document.mimeType);
      res.setHeader(
        "Content-Disposition",
        ApplicationLetterController.buildContentDisposition(document.fileName)
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
    const safeName = asciiSafe || "application-letter";
    const encoded = encodeURIComponent(fileName);

    return `attachment; filename="${safeName}"; filename*=UTF-8''${encoded}`;
  }

  static async massDelete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ApplicationLetterService.massDelete(
        req.user!.id,
        req.body
      );
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
}
