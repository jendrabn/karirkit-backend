import { Request, Response, NextFunction } from "express";
import { BlogService } from "../services/blog.service";
import { sendSuccess } from "../utils/response-builder.util";

export class BlogController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await BlogService.list(req.query);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async getBySlug(req: Request, res: Response, next: NextFunction) {
    try {
      const blog = await BlogService.getBySlug(req.params.slug);
      sendSuccess(res, blog);
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const blog = await BlogService.create(req.user!.id, req.body);
      sendSuccess(res, blog, 201);
    } catch (error) {
      next(error);
    }
  }

  static async get(req: Request, res: Response, next: NextFunction) {
    try {
      const blog = await BlogService.get(req.user!.id, req.params.id);
      sendSuccess(res, blog);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const blog = await BlogService.update(
        req.user!.id,
        req.params.id,
        req.body
      );
      sendSuccess(res, blog);
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await BlogService.delete(req.user!.id, req.params.id);
      sendSuccess(res);
    } catch (error) {
      next(error);
    }
  }

  static async getCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const categories = await BlogService.getCategories();
      sendSuccess(res, { items: categories });
    } catch (error) {
      next(error);
    }
  }

  static async getTags(req: Request, res: Response, next: NextFunction) {
    try {
      const tags = await BlogService.getTags();
      sendSuccess(res, { items: tags });
    } catch (error) {
      next(error);
    }
  }

  static async latest(req: Request, res: Response, next: NextFunction) {
    try {
      // Parse limit parameter with validation
      let limit = parseInt(req.query.limit as string) || 4;
      limit = Math.min(Math.max(limit, 1), 20); // Clamp between 1-20

      const blogs = await BlogService.getLatest(limit);
      sendSuccess(res, blogs);
    } catch (error) {
      next(error);
    }
  }
}
