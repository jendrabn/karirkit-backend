import { Request, Response, NextFunction } from "express";
import { DashboardService } from "../../services/admin/dashboard.service";
import { sendSuccess } from "../../utils/response-builder.util";

export class DashboardController {
  static async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await DashboardService.getStats();
      sendSuccess(res, stats);
    } catch (error) {
      next(error);
    }
  }
}
