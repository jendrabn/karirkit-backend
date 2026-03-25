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

  static async bulkUpdate(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await SystemSettingService.bulkUpdate(req.body, req.user!.id);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
}
