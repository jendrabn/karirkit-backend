import { Request, Response, NextFunction } from "express";
import { BlogService } from "../../services/admin/blog.service";
import { sendSuccess } from "../../utils/response-builder.util";

export class BlogController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await BlogService.list(req.query);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async get(req: Request, res: Response, next: NextFunction) {
    try {
      const blog = await BlogService.get(req.params.id);
      sendSuccess(res, blog);
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const blog = await BlogService.create(req.body);
      sendSuccess(res, blog, 201);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const blog = await BlogService.update(req.params.id, req.body);
      sendSuccess(res, blog);
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await BlogService.delete(req.params.id);
      sendSuccess(res);
    } catch (error) {
      next(error);
    }
  }

  static async massDelete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await BlogService.massDelete(req.body);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
}
