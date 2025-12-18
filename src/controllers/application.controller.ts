import { Request, Response, NextFunction } from "express";
import { ApplicationService } from "../services/application.service";
import { sendSuccess } from "../utils/response-builder.util";

export class ApplicationController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ApplicationService.list(req.user!.id, req.query);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const application = await ApplicationService.create(
        req.user!.id,
        req.body
      );
      sendSuccess(res, application, 201);
    } catch (error) {
      next(error);
    }
  }

  static async get(req: Request, res: Response, next: NextFunction) {
    try {
      const application = await ApplicationService.get(
        req.user!.id,
        req.params.id
      );
      sendSuccess(res, application);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const application = await ApplicationService.update(
        req.user!.id,
        req.params.id,
        req.body
      );
      sendSuccess(res, application);
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await ApplicationService.delete(req.user!.id, req.params.id);
      sendSuccess(res);
    } catch (error) {
      next(error);
    }
  }

  static async duplicate(req: Request, res: Response, next: NextFunction) {
    try {
      const application = await ApplicationService.duplicate(
        req.user!.id,
        req.params.id
      );
      sendSuccess(res, application, 201);
    } catch (error) {
      next(error);
    }
  }

  static async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await ApplicationService.getStats(req.user!.id);
      sendSuccess(res, stats);
    } catch (error) {
      next(error);
    }
  }
}
