import type { NextFunction, Request, Response } from "express";
import env from "../config/env.config";
import { SubscriptionService } from "../services/subscription.service";
import { sendSuccess } from "../utils/response-builder.util";

const toPlanResponse = (plan: Record<string, any>) => ({
  id: plan.id,
  name: plan.name,
  price: plan.price,
  duration_days: plan.durationDays,
  max_cvs: plan.maxCvs,
  max_applications: plan.maxApplications,
  max_application_letters: plan.maxApplicationLetters,
  max_document_storage_bytes: plan.maxDocumentStorageBytes,
  max_cv_pdf_downloads: plan.maxCvPdfDownloads,
  max_cv_docx_downloads: plan.maxCvDocxDownloads,
  max_letter_pdf_downloads: plan.maxLetterPdfDownloads,
  max_letter_docx_downloads: plan.maxLetterDocxDownloads,
  max_cv_ai_improvements: plan.maxCvAiImprovements,
  max_application_letter_ai_improvements: plan.maxApplicationLetterAiImprovements,
  can_use_premium_cv_templates: plan.canUsePremiumCvTemplates,
  can_use_premium_application_letter_templates:
    plan.canUsePremiumApplicationLetterTemplates,
});

const toCurrentSubscriptionResponse = (result: Record<string, any>) => ({
  id: result.id,
  plan: result.plan,
  pending_plan: result.pendingPlan,
  status: result.status,
  amount: result.amount,
  paid_at: result.paidAt,
  expires_at: result.expiresAt,
  gateway: result.gateway,
  order_id: result.orderId,
  provider_token: result.providerToken,
  payment_type: result.paymentType,
  midtrans_order_id: result.orderId,
  snap_token: result.providerToken,
  snap_url: result.snapUrl,
  can_resume_payment: result.canResumePayment,
  midtrans_payment_type: result.paymentType,
  current_limits: {
    max_cvs: result.currentLimits.maxCvs,
    max_applications: result.currentLimits.maxApplications,
    max_application_letters: result.currentLimits.maxApplicationLetters,
    max_document_storage_bytes: result.currentLimits.maxDocumentStorageBytes,
    max_cv_pdf_downloads: result.currentLimits.maxCvPdfDownloads,
    max_cv_docx_downloads: result.currentLimits.maxCvDocxDownloads,
    max_letter_pdf_downloads: result.currentLimits.maxLetterPdfDownloads,
    max_letter_docx_downloads: result.currentLimits.maxLetterDocxDownloads,
    max_cv_ai_improvements: result.currentLimits.maxCvAiImprovements,
    max_application_letter_ai_improvements: result.currentLimits.maxApplicationLetterAiImprovements,
  },
  current_features: {
    can_use_premium_cv_templates:
      result.currentFeatures.canUsePremiumCvTemplates,
    can_use_premium_application_letter_templates:
      result.currentFeatures.canUsePremiumApplicationLetterTemplates,
  },
});

const toOrderResponse = (result: Record<string, any>) => ({
  subscription_id: result.subscriptionId,
  order_id: result.orderId,
  gateway: result.gateway,
  snap_token: result.snapToken,
  snap_url: result.snapUrl || null,
  amount: result.amount,
  plan: result.plan,
});

export class SubscriptionController {
  static async getPlans(_req: Request, res: Response, next: NextFunction) {
    try {
      const plans = SubscriptionService.getPlans();
      sendSuccess(res, {
        payment_gateway_enabled: env.paymentGatewayEnabled,
        plans: plans.map((plan) =>
          toPlanResponse(plan as Record<string, any>)
        ),
      });
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
      sendSuccess(res, toCurrentSubscriptionResponse(result));
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
      sendSuccess(res, toOrderResponse(result), 201);
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
