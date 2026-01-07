import { Request, Response, NextFunction } from "express";
import { UserService } from "../../services/admin/user.service";
import { sendSuccess } from "../../utils/response-builder.util";

export class UserController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await UserService.list(req.query);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async get(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await UserService.get(req.params.id);
      sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await UserService.create(req.body);
      sendSuccess(res, user, 201);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await UserService.update(req.params.id, req.body);
      sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  }

  static async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await UserService.updateStatus(req.params.id, req.body);
      sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  }

  static async updateDailyDownloadLimit(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const user = await UserService.updateDailyDownloadLimit(
        req.params.id,
        req.body
      );
      sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  }

  static async updateStorageLimit(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const user = await UserService.updateStorageLimit(
        req.params.id,
        req.body
      );
      sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await UserService.delete(req.params.id);
      sendSuccess(res);
    } catch (error) {
      next(error);
    }
  }

  static async massDelete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await UserService.massDelete(req.body);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
}
