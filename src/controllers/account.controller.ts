import { NextFunction, Request, Response } from "express";
import { AccountService } from "../services/account.service";
import { UploadService } from "../services/upload.service";
import { ChangePasswordRequest, UpdateMeRequest } from "../types/api-schemas";
import { sendSuccess } from "../utils/response-builder.util";
import { ResponseError } from "../utils/response-error.util";
import { DownloadLogService } from "../services/download-log.service";

export class AccountController {
  static async me(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await AccountService.me(req.user!.id);
      sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  }

  static async updateMe(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      let avatarPath: string | null = null;

      // Handle avatar file upload if provided
      if (req.file) {
        const uploadResult = await UploadService.uploadFile(req.file);
        avatarPath = uploadResult.path;
      }

      // Prepare payload with avatar path if uploaded
      const payload = { ...req.body } as UpdateMeRequest;
      if (avatarPath) {
        payload.avatar = avatarPath;
      }

      const user = await AccountService.updateMe(userId, payload);

      sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  }

  static async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      await AccountService.changePassword(
        req.user!.id,
        req.body as ChangePasswordRequest
      );

      sendSuccess(res, {
        message: "Password updated successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  static async getDownloadStats(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const stats = await DownloadLogService.getDownloadStats(req.user!.id);
      sendSuccess(res, stats);
    } catch (error) {
      next(error);
    }
  }
}
