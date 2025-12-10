import { NextFunction, Request, Response } from "express";
import { UploadService } from "../services/upload.service";
import { sendSuccess } from "../utils/response-builder.util";
import { ResponseError } from "../utils/response-error.util";

export class UploadController {
  static async uploadTemp(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new ResponseError(401, "Unauthenticated");
      }

      const result = await UploadService.uploadTempFile(userId, req.file);
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  }
}
