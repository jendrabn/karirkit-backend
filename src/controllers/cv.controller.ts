import { Request, Response, NextFunction } from "express";
import { CvService } from "../services/cv.service";
import { sendSuccess } from "../utils/response-builder.util";
import { ResponseError } from "../utils/response-error.util";
import { DownloadLogService } from "../services/download-log.service";
import { DownloadType } from "../generated/prisma/client";

export class CvController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await CvService.list(req.user!.id, req.query);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async get(req: Request, res: Response, next: NextFunction) {
    try {
      const cv = await CvService.get(req.user!.id, req.params.id);
      sendSuccess(res, cv);
    } catch (error) {
      next(error);
    }
  }

  static async getPublicBySlug(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const cv = await CvService.getPublicBySlug(req.params.slug);
      sendSuccess(res, cv);
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const cv = await CvService.create(req.user!.id, req.body);
      sendSuccess(res, cv, 201);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const cv = await CvService.update(req.user!.id, req.params.id, req.body);
      sendSuccess(res, cv);
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await CvService.delete(req.user!.id, req.params.id);
      sendSuccess(res);
    } catch (error) {
      next(error);
    }
  }

  static async massDelete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await CvService.massDelete(req.user!.id, req.body);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async duplicate(req: Request, res: Response, next: NextFunction) {
    try {
      const cv = await CvService.duplicate(req.user!.id, req.params.id);
      sendSuccess(res, cv, 201);
    } catch (error) {
      next(error);
    }
  }

  static async download(req: Request, res: Response, next: NextFunction) {
    try {
      const rawFormat = Array.isArray(req.query.format)
        ? req.query.format[0]
        : req.query.format;
      const format = typeof rawFormat === "string" ? rawFormat : undefined;

      await DownloadLogService.checkDownloadLimit(req.user!.id);
      const document = await CvService.download(
        req.user!.id,
        req.params.id,
        format
      );

      await DownloadLogService.logDownload(
        req.user!.id,
        DownloadType.cv,
        req.params.id,
        document.fileName
      );

      res.setHeader("Content-Type", document.mimeType);
      res.setHeader(
        "Content-Disposition",
        CvController.buildContentDisposition(document.fileName)
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
    const safeName = asciiSafe || "cv-document";
    const encoded = encodeURIComponent(fileName);

    return `attachment; filename="${safeName}"; filename*=UTF-8''${encoded}`;
  }
}
