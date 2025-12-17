import { Request, Response, NextFunction } from "express";
import { TemplateService } from "../../services/admin/template.service";
import { sendSuccess } from "../../utils/response-builder.util";

export class TemplateController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await TemplateService.list(req.query);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async get(req: Request, res: Response, next: NextFunction) {
    try {
      const template = await TemplateService.get(req.params.id);
      sendSuccess(res, template);
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const template = await TemplateService.create(req.body);
      sendSuccess(res, template, 201);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const template = await TemplateService.update(req.params.id, req.body);
      sendSuccess(res, template);
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await TemplateService.delete(req.params.id);
      sendSuccess(res);
    } catch (error) {
      next(error);
    }
  }
}
