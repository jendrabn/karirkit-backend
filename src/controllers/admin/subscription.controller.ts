import type { NextFunction, Request, Response } from "express";
import { SubscriptionService } from "../../services/subscription.service";
import { sendSuccess } from "../../utils/response-builder.util";

const toAdminSubscriptionResponse = (result: Record<string, any>) => ({
  id: result.id,
  user_id: result.userId,
  user: result.user,
  plan: result.plan,
  status: result.status,
  amount: result.amount,
  midtrans_order_id: result.midtransOrderId,
  midtrans_token: result.midtransToken,
  midtrans_payment_type: result.midtransPaymentType,
  paid_at: result.paidAt,
  expires_at: result.expiresAt,
  created_at: result.createdAt,
  updated_at: result.updatedAt,
});

export class SubscriptionController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await SubscriptionService.createManualSubscription(
        req.body
      );
      sendSuccess(res, toAdminSubscriptionResponse(result), 201);
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await SubscriptionService.listAdminSubscriptions(req.query);
      sendSuccess(res, {
        items: result.items.map((item) =>
          toAdminSubscriptionResponse(item as Record<string, any>)
        ),
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  static async get(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await SubscriptionService.getAdminSubscription(
        req.params.id
      );
      sendSuccess(res, toAdminSubscriptionResponse(result));
    } catch (error) {
      next(error);
    }
  }

  static async manualApprove(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      await SubscriptionService.manualApprove(req.params.id);
      sendSuccess(res, { message: "Subscription approved" });
    } catch (error) {
      next(error);
    }
  }

  static async manualCancel(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      await SubscriptionService.manualCancel(req.params.id);
      sendSuccess(res, { message: "Subscription cancelled" });
    } catch (error) {
      next(error);
    }
  }

  static async markFailed(req: Request, res: Response, next: NextFunction) {
    try {
      await SubscriptionService.markFailed(req.params.id);
      sendSuccess(res, { message: "Subscription marked as failed" });
    } catch (error) {
      next(error);
    }
  }

  static async forceDowngrade(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      await SubscriptionService.forceDowngradeToFree(req.params.userId);
      sendSuccess(res, { message: "User downgraded to Free" });
    } catch (error) {
      next(error);
    }
  }
}
