import { Request, Response, NextFunction } from "express";
import { AdminJobRoleService } from "../../services/admin/job-role.service";
import { validate } from "../../utils/validate.util";
import { JobRoleValidation } from "../../validations/admin/job-role.validation";
import { sendSuccess } from "../../utils/response-builder.util";

export class JobRoleController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const query = validate(JobRoleValidation.LIST_QUERY, req.query);
      const result = await AdminJobRoleService.list(query);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async get(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = validate(JobRoleValidation.ID_PARAM, req.params);
      const result = await AdminJobRoleService.get(id);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = validate(JobRoleValidation.CREATE, req.body);
      const result = await AdminJobRoleService.create(data);
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = validate(JobRoleValidation.ID_PARAM, req.params);
      const data = validate(JobRoleValidation.UPDATE, req.body);
      const result = await AdminJobRoleService.update(id, data);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = validate(JobRoleValidation.ID_PARAM, req.params);
      await AdminJobRoleService.delete(id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  static async massDelete(req: Request, res: Response, next: NextFunction) {
    try {
      const { ids } = validate(JobRoleValidation.MASS_DELETE, req.body);
      const result = await AdminJobRoleService.massDelete(ids);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
}
