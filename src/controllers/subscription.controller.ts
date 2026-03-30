import type { NextFunction, Request, Response } from "express";
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
  cv_downloads_per_day: plan.cvDownloadsPerDay,
  application_letter_downloads_per_day: plan.applicationLetterDownloadsPerDay,
  cv_docx_downloads_per_day: plan.cvDocxDownloadsPerDay,
  application_letter_docx_downloads_per_day:
    plan.applicationLetterDocxDownloadsPerDay,
  cv_pdf_downloads_per_day: plan.cvPdfDownloadsPerDay,
  application_letter_pdf_downloads_per_day:
    plan.applicationLetterPdfDownloadsPerDay,
  can_manage_documents: plan.canManageDocuments,
  can_use_premium_cv_templates: plan.canUsePremiumCvTemplates,
  can_use_premium_application_letter_templates:
    plan.canUsePremiumApplicationLetterTemplates,
  can_use_premium_templates: plan.canUsePremiumTemplates,
  can_duplicate_cvs: plan.canDuplicateCvs,
  can_duplicate_applications: plan.canDuplicateApplications,
  can_duplicate_application_letters: plan.canDuplicateApplicationLetters,
  can_download_cv_docx: plan.canDownloadCvDocx,
  can_download_application_letter_docx:
    plan.canDownloadApplicationLetterDocx,
  can_download_cv_pdf: plan.canDownloadCvPdf,
  can_download_application_letter_pdf: plan.canDownloadApplicationLetterPdf,
});

const toCurrentSubscriptionResponse = (result: Record<string, any>) => ({
  id: result.id,
  plan: result.plan,
  pending_plan: result.pendingPlan,
  status: result.status,
  amount: result.amount,
  paid_at: result.paidAt,
  expires_at: result.expiresAt,
  midtrans_order_id: result.midtransOrderId,
  snap_token: result.midtransToken,
  snap_url: result.snapUrl,
  can_resume_payment: result.canResumePayment,
  midtrans_payment_type: result.midtransPaymentType,
  current_limits: {
    max_cvs: result.currentLimits.maxCvs,
    max_applications: result.currentLimits.maxApplications,
    max_application_letters: result.currentLimits.maxApplicationLetters,
    max_document_storage_bytes: result.currentLimits.maxDocumentStorageBytes,
    downloads: {
      cv_per_day: result.currentLimits.downloads.cvPerDay,
      application_letter_per_day:
        result.currentLimits.downloads.applicationLetterPerDay,
      cv_docx_per_day: result.currentLimits.downloads.cvDocxPerDay,
      application_letter_docx_per_day:
        result.currentLimits.downloads.applicationLetterDocxPerDay,
      cv_pdf_per_day: result.currentLimits.downloads.cvPdfPerDay,
      application_letter_pdf_per_day:
        result.currentLimits.downloads.applicationLetterPdfPerDay,
    },
  },
  current_features: {
    can_manage_documents: result.currentFeatures.canManageDocuments,
    can_use_premium_cv_templates:
      result.currentFeatures.canUsePremiumCvTemplates,
    can_use_premium_application_letter_templates:
      result.currentFeatures.canUsePremiumApplicationLetterTemplates,
    can_use_premium_templates: result.currentFeatures.canUsePremiumTemplates,
    can_duplicate_cvs: result.currentFeatures.canDuplicateCvs,
    can_duplicate_applications: result.currentFeatures.canDuplicateApplications,
    can_duplicate_application_letters:
      result.currentFeatures.canDuplicateApplicationLetters,
    can_download_cv_docx: result.currentFeatures.canDownloadCvDocx,
    can_download_application_letter_docx:
      result.currentFeatures.canDownloadApplicationLetterDocx,
    can_download_cv_pdf: result.currentFeatures.canDownloadCvPdf,
    can_download_application_letter_pdf:
      result.currentFeatures.canDownloadApplicationLetterPdf,
  },
});

const toOrderResponse = (result: Record<string, any>) => ({
  subscription_id: result.subscriptionId,
  order_id: result.orderId,
  snap_token: result.snapToken,
  snap_url: result.snapUrl || null,
  amount: result.amount,
  plan: result.plan,
});

export class SubscriptionController {
  static async getPlans(_req: Request, res: Response, next: NextFunction) {
    try {
      const plans = SubscriptionService.getPlans();
      sendSuccess(
        res,
        plans.map((plan) => toPlanResponse(plan as Record<string, any>))
      );
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
