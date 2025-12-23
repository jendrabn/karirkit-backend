import { Request, Response, NextFunction } from "express";
import { PortfolioService } from "../services/portfolio.service";
import { sendSuccess } from "../utils/response-builder.util";

export class PortfolioController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const portfolios = await PortfolioService.list(req.user!.id, req.query);
      sendSuccess(res, portfolios);
    } catch (error) {
      next(error);
    }
  }

  static async get(req: Request, res: Response, next: NextFunction) {
    try {
      const portfolio = await PortfolioService.get(req.user!.id, req.params.id);
      sendSuccess(res, portfolio);
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const portfolio = await PortfolioService.create(req.user!.id, req.body);
      sendSuccess(res, portfolio, 201);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const portfolio = await PortfolioService.update(
        req.user!.id,
        req.params.id,
        req.body
      );
      sendSuccess(res, portfolio);
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await PortfolioService.delete(req.user!.id, req.params.id);
      sendSuccess(res);
    } catch (error) {
      next(error);
    }
  }

  static async massDelete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await PortfolioService.massDelete(req.user!.id, req.body);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
}
