import { NextFunction, Request, Response } from "express";
import { AccountService } from "../services/account.service";
import { ChangePasswordRequest, UpdateMeRequest } from "../types/api-schemas";
import { sendSuccess } from "../utils/response-builder.util";

export class AccountController {
  static async me(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await AccountService.me(req.user!.id);
      sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  }

  static async updateMe(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = (req.body ?? {}) as UpdateMeRequest;
      const user = await AccountService.updateMe(req.user!.id, payload);

      sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  }

  static async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      await AccountService.changePassword(
        req.user!.id,
        req.body as ChangePasswordRequest
      );

      sendSuccess(res, {
        message: "Password updated successfully",
      });
    } catch (error) {
      next(error);
    }
  }
}
