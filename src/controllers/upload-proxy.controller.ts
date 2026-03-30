import type { NextFunction, Request, Response } from "express";
import { StorageService } from "../services/storage.service";
import { ResponseError } from "../utils/response-error.util";

export class UploadProxyController {
  static async serve(req: Request, res: Response, next: NextFunction) {
    try {
      const normalizedPath = StorageService.normalizeUploadsPath(req.path);
      if (!normalizedPath) {
        throw new ResponseError(404, "File tidak ditemukan");
      }

      const stored = await StorageService.read(normalizedPath);
      if (stored.contentType) {
        res.type(stored.contentType);
      }
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.send(stored.buffer);
    } catch (error) {
      next(error);
    }
  }
}
