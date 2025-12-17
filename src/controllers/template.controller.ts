import { Request, Response, NextFunction } from "express";
import { TemplateService } from "../services/template.service";
import { sendSuccess } from "../utils/response-builder.util";

export class TemplateController {
  static async getTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      const { type, language } = req.query;

      const templates = await TemplateService.getTemplates({
        type: type as "cv" | "application_letter",
        language: language as "en" | "id",
      });

      return sendSuccess(res, {
        items: templates,
      });
    } catch (error) {
      next(error);
    }
  }
}
