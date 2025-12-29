import { Request, Response, NextFunction } from "express";
import { AdminCompanyService } from "../../services/admin/company.service";
import { validate } from "../../utils/validate.util";
import { CompanyValidation } from "../../validations/admin/company.validation";
import { sendSuccess } from "../../utils/response-builder.util";

export class CompanyController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const query = validate(CompanyValidation.LIST_QUERY, req.query);
      const result = await AdminCompanyService.list(query);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async get(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = validate(CompanyValidation.ID_PARAM, req.params);
      const result = await AdminCompanyService.get(id);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = validate(CompanyValidation.CREATE, req.body);
      const result = await AdminCompanyService.create(data);
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = validate(CompanyValidation.ID_PARAM, req.params);
      const data = validate(CompanyValidation.UPDATE, req.body);
      const result = await AdminCompanyService.update(id, data);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = validate(CompanyValidation.ID_PARAM, req.params);
      await AdminCompanyService.delete(id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  static async massDelete(req: Request, res: Response, next: NextFunction) {
    try {
      const { ids } = validate(CompanyValidation.MASS_DELETE, req.body);
      const result = await AdminCompanyService.massDelete(ids);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
}
