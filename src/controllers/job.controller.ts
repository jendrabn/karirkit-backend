import { Request, Response, NextFunction } from "express";
import { JobService } from "../services/job.service";
import { validate } from "../utils/validate.util";
import { JobValidation } from "../validations/job.validation";
import { sendSuccess } from "../utils/response-builder.util";

export class JobController {
  static async getJobs(req: Request, res: Response, next: NextFunction) {
    try {
      const query = validate(JobValidation.LIST_QUERY, req.query);
      const result = await JobService.list(query, req.user?.id);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async getJobBySlug(req: Request, res: Response, next: NextFunction) {
    try {
      const { slug } = validate(JobValidation.SLUG_PARAM, req.params);
      const result = await JobService.getBySlug(slug, req.user?.id);
      sendSuccess(res, result, 200, true);
    } catch (error) {
      next(error);
    }
  }

  static async listSavedJobs(req: Request, res: Response, next: NextFunction) {
    try {
      const query = validate(JobValidation.SAVED_LIST_QUERY, req.query);
      const result = await JobService.listSavedJobs(req.user!.id, query);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async toggleSavedJob(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = validate(JobValidation.TOGGLE_SAVED_JOB, req.body);
      const result = await JobService.toggleSavedJob(req.user!.id, payload);
      sendSuccess(res, result, 200, true);
    } catch (error) {
      next(error);
    }
  }

  static async massDeleteSavedJobs(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = validate(JobValidation.MASS_DELETE_SAVED_JOBS, req.body);
      const result = await JobService.massDeleteSavedJobs(req.user!.id, payload);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
}
