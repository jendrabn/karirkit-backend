import { Request, Response, NextFunction } from "express";
import { AdminJobService } from "../../services/admin/job.service";
import { validate } from "../../utils/validate.util";
import { JobValidation } from "../../validations/admin/job.validation";
import { sendSuccess } from "../../utils/response-builder.util";

export class JobController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const query = validate(JobValidation.LIST_QUERY, req.query);
      const result = await AdminJobService.list(query);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async get(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = validate(JobValidation.ID_PARAM, req.params);
      const result = await AdminJobService.get(id);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = validate(JobValidation.CREATE, req.body);
      const result = await AdminJobService.create(data);
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = validate(JobValidation.ID_PARAM, req.params);
      const data = validate(JobValidation.UPDATE, req.body);
      const result = await AdminJobService.update(id, data);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = validate(JobValidation.ID_PARAM, req.params);
      await AdminJobService.delete(id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  static async massDelete(req: Request, res: Response, next: NextFunction) {
    try {
      const { ids } = validate(JobValidation.MASS_DELETE, req.body);
      const result = await AdminJobService.massDelete(ids);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
}
