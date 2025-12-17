import { Request, Response, NextFunction } from "express";
import { BlogCategoryService } from "../../services/admin/blog-category.service";
import { sendSuccess } from "../../utils/response-builder.util";

export class BlogCategoryController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await BlogCategoryService.list(req.query);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async get(req: Request, res: Response, next: NextFunction) {
    try {
      const category = await BlogCategoryService.get(req.params.id);
      sendSuccess(res, category);
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const category = await BlogCategoryService.create(req.body);
      sendSuccess(res, category, 201);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const category = await BlogCategoryService.update(
        req.params.id,
        req.body
      );
      sendSuccess(res, category);
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await BlogCategoryService.delete(req.params.id);
      sendSuccess(res);
    } catch (error) {
      next(error);
    }
  }
}
