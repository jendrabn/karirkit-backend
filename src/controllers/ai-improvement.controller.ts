import type { NextFunction, Request, Response } from "express";
import { AiService } from "../services/ai.service";
import { buildAiImprovementSummary } from "../utils/ai-improvement-summary.util";
import { validate } from "../utils/validate.util";
import {
  AiImprovementValidation,
  type ApplicationLetterAiImprovementInput,
  type CvAiImprovementInput,
} from "../validations/ai-improvement.validation";

export class AiImprovementController {
  static async improveCv(req: Request, res: Response, next: NextFunction) {
    try {
      const payload: CvAiImprovementInput = validate(
        AiImprovementValidation.CV,
        req.body
      );

      const improvedData = await AiService.improveCv(
        payload.data,
        payload.data.language,
        payload.target_position,
        payload.job_description
      );
      await AiService.logAiUsage(req.user!.id, "cv");

      res.status(200).json({
        data: improvedData,
        meta: {
          improvement_summary: buildAiImprovementSummary(
            payload.data,
            improvedData,
            payload.data.language
          ),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async improveApplicationLetter(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const payload: ApplicationLetterAiImprovementInput = validate(
        AiImprovementValidation.APPLICATION_LETTER,
        req.body
      );

      const improvedData = await AiService.improveApplicationLetter(
        payload.data,
        payload.data.language,
        payload.target_position,
        payload.job_description
      );
      await AiService.logAiUsage(req.user!.id, "application_letter");

      res.status(200).json({
        data: improvedData,
        meta: {
          improvement_summary: buildAiImprovementSummary(
            payload.data,
            improvedData,
            payload.data.language
          ),
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
