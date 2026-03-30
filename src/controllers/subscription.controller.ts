import type { NextFunction, Request, Response } from "express";
import { SubscriptionService } from "../services/subscription.service";
import { sendSuccess } from "../utils/response-builder.util";

export class SubscriptionController {
  static async getPlans(_req: Request, res: Response, next: NextFunction) {
    try {
      const plans = SubscriptionService.getPlans();
      sendSuccess(res, plans);
    } catch (error) {
      next(error);
    }
  }

  static async getMySubscription(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const result = await SubscriptionService.getCurrentSubscription(
        req.user!.id
      );
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async createOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await SubscriptionService.createSubscriptionOrder(
        req.user!.id,
        req.body
      );
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  }

  static async handleMidtransNotification(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      await SubscriptionService.handleMidtransNotification(req.body);
      sendSuccess(res, { message: "OK" });
    } catch (error) {
      next(error);
    }
  }

  static async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      await SubscriptionService.cancelSubscription(req.user!.id, req.params.id);
      sendSuccess(res, { message: "Subscription cancelled" });
    } catch (error) {
      next(error);
    }
  }
}
