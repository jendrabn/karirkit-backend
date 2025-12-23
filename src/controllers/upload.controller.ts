import { NextFunction, Request, Response } from "express";
import { UploadService } from "../services/upload.service";
import { sendSuccess } from "../utils/response-builder.util";
import { ResponseError } from "../utils/response-error.util";

export class UploadController {
  static async uploadTemp(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new ResponseError(401, "Tidak terautentikasi");
      }

      const qualityQuery = req.query.quality as string;
      const webpQuery = req.query.webp as string;
      const formatQuery = req.query.format as string;

      let quality = 50;
      if (qualityQuery && qualityQuery !== "") {
        const parsed = parseInt(qualityQuery);
        if (!isNaN(parsed)) {
          quality = Math.max(25, Math.min(100, parsed));
        }
      }

      const toWebp = webpQuery !== "false";
      const format =
        formatQuery && formatQuery !== "" ? formatQuery : undefined;

      if (!req.file) {
        throw new ResponseError(400, "File diperlukan");
      }

      const result = await UploadService.uploadFile(req.file, "uploads/temp", {
        quality,
        webp: toWebp,
        format,
      });
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  }

  static async uploadBlog(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        throw new ResponseError(400, "File diperlukan");
      }

      const result = await UploadService.uploadFile(req.file, "uploads/blogs");
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  }
}
