import { Request, Response, NextFunction } from "express";
import { BlogTagService } from "../../services/admin/blog-tag.service";
import { sendSuccess } from "../../utils/response-builder.util";

export class BlogTagController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await BlogTagService.list(req.query);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async get(req: Request, res: Response, next: NextFunction) {
    try {
      const tag = await BlogTagService.get(req.params.id);
      sendSuccess(res, tag);
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const tag = await BlogTagService.create(req.body);
      sendSuccess(res, tag, 201);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const tag = await BlogTagService.update(req.params.id, req.body);
      sendSuccess(res, tag);
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await BlogTagService.delete(req.params.id);
      sendSuccess(res);
    } catch (error) {
      next(error);
    }
  }
}
