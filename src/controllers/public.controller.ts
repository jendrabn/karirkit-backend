import { Request, Response, NextFunction } from "express";
import { PublicPortfolioService } from "../services/public-portfolio.service";
import { sendSuccess } from "../utils/response-builder.util";

export class PublicController {
  static async getPortfolioListing(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const result = await PublicPortfolioService.listByUsername(
        req.params.username
      );
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async getPortfolioDetail(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const result = await PublicPortfolioService.getPortfolioDetail(
        req.params.username,
        req.params.id
      );
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
}
