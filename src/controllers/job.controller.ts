import { Request, Response, NextFunction } from "express";
import { JobService } from "../services/job.service";
import { validate } from "../utils/validate.util";
import { JobValidation } from "../validations/job.validation";
import { sendSuccess } from "../utils/response-builder.util";

export class JobController {
  static async getJobs(req: Request, res: Response, next: NextFunction) {
    try {
      const query = validate(JobValidation.LIST_QUERY, req.query);
      const result = await JobService.list(query);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async getJobBySlug(req: Request, res: Response, next: NextFunction) {
    try {
      const { slug } = validate(JobValidation.SLUG_PARAM, req.params);
      const result = await JobService.getBySlug(slug);
      sendSuccess(res, result, 200, true);
    } catch (error) {
      next(error);
    }
  }
}
