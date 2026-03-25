import { NextFunction, Request, Response } from "express";
import { SystemSettingService } from "../../services/system-setting.service";
import { sendSuccess } from "../../utils/response-builder.util";

export class SystemSettingController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await SystemSettingService.list(req.query);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await SystemSettingService.update(
        req.params.key,
        req.body,
        req.user!.id
      );
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
}
