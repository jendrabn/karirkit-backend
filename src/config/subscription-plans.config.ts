export type PlanId = 'free' | 'pro' | 'max';

export type DownloadKind = "cv" | "application_letter";
export type DownloadFormat = "pdf" | "docx";
export type DuplicateKind = "cv" | "application" | "application_letter";

export interface SubscriptionPlan {
  id: PlanId;
  name: string;
  /** Price in IDR. 0 = free */
  price: number;
  /** Duration of the subscription in days. 0 = no expiry */
  durationDays: number;
  /** Maximum number of CVs. -1 = unlimited */
  maxCvs: number;
  /** Maximum number of Application Letters. -1 = unlimited */
  maxApplicationLetters: number;
  /** Maximum number of application tracker records. -1 = unlimited */
  maxApplications: number;
  /** Maximum document storage in bytes. -1 = unlimited */
  maxDocumentStorageBytes: number;
  /** Maximum CV downloads per day across PDF/DOCX. -1 = unlimited */
  cvDownloadsPerDay: number;
  /** Maximum application letter downloads per day across PDF/DOCX. -1 = unlimited */
  applicationLetterDownloadsPerDay: number;
  /** Maximum CV DOCX downloads per day. -1 = unlimited */
  cvDocxDownloadsPerDay: number;
  /** Maximum application letter DOCX downloads per day. -1 = unlimited */
  applicationLetterDocxDownloadsPerDay: number;
  /** Maximum CV PDF downloads per day. Currently mirrors cvDownloadsPerDay. -1 = unlimited */
  cvPdfDownloadsPerDay: number;
  /** Maximum application letter PDF downloads per day. Currently mirrors applicationLetterDownloadsPerDay. -1 = unlimited */
  applicationLetterPdfDownloadsPerDay: number;
  canManageDocuments: boolean;
  canUsePremiumCvTemplates: boolean;
  canUsePremiumApplicationLetterTemplates: boolean;
  canUsePremiumTemplates: boolean;
  canDuplicateCvs: boolean;
  canDuplicateApplications: boolean;
  canDuplicateApplicationLetters: boolean;
  canDownloadCvDocx: boolean;
  canDownloadApplicationLetterDocx: boolean;
  canDownloadCvPdf: boolean;
  canDownloadApplicationLetterPdf: boolean;
}

export interface UserSubscriptionState {
  subscriptionPlan: PlanId;
  subscriptionExpiresAt: Date | null;
}

export const SUBSCRIPTION_PLANS: Record<PlanId, SubscriptionPlan> = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    durationDays: 0,
    maxCvs: 5,
    maxApplicationLetters: 5,
    maxApplications: 100,
    maxDocumentStorageBytes: 0,
    cvDownloadsPerDay: 5,
    applicationLetterDownloadsPerDay: 5,
    cvDocxDownloadsPerDay: 5,
    applicationLetterDocxDownloadsPerDay: 5,
    cvPdfDownloadsPerDay: 5,
    applicationLetterPdfDownloadsPerDay: 5,
    canManageDocuments: false,
    canUsePremiumCvTemplates: false,
    canUsePremiumApplicationLetterTemplates: false,
    canUsePremiumTemplates: false,
    canDuplicateCvs: true,
    canDuplicateApplications: true,
    canDuplicateApplicationLetters: true,
    canDownloadCvDocx: true,
    canDownloadApplicationLetterDocx: true,
    canDownloadCvPdf: true,
    canDownloadApplicationLetterPdf: true,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 25000,
    durationDays: 30,
    maxCvs: 15,
    maxApplicationLetters: 15,
    maxApplications: 500,
    maxDocumentStorageBytes: 104857600, // 100 MB
    cvDownloadsPerDay: 15,
    applicationLetterDownloadsPerDay: 15,
    cvDocxDownloadsPerDay: 15,
    applicationLetterDocxDownloadsPerDay: 15,
    cvPdfDownloadsPerDay: 15,
    applicationLetterPdfDownloadsPerDay: 15,
    canManageDocuments: true,
    canUsePremiumCvTemplates: true,
    canUsePremiumApplicationLetterTemplates: true,
    canUsePremiumTemplates: true,
    canDuplicateCvs: true,
    canDuplicateApplications: true,
    canDuplicateApplicationLetters: true,
    canDownloadCvDocx: true,
    canDownloadApplicationLetterDocx: true,
    canDownloadCvPdf: true,
    canDownloadApplicationLetterPdf: true,
  },
  max: {
    id: 'max',
    name: 'Max',
    price: 50000,
    durationDays: 30,
    maxCvs: -1,
    maxApplicationLetters: -1,
    maxApplications: -1,
    maxDocumentStorageBytes: 524288000, // 500 MB
    cvDownloadsPerDay: -1,
    applicationLetterDownloadsPerDay: -1,
    cvDocxDownloadsPerDay: -1,
    applicationLetterDocxDownloadsPerDay: -1,
    cvPdfDownloadsPerDay: -1,
    applicationLetterPdfDownloadsPerDay: -1,
    canManageDocuments: true,
    canUsePremiumCvTemplates: true,
    canUsePremiumApplicationLetterTemplates: true,
    canUsePremiumTemplates: true,
    canDuplicateCvs: true,
    canDuplicateApplications: true,
    canDuplicateApplicationLetters: true,
    canDownloadCvDocx: true,
    canDownloadApplicationLetterDocx: true,
    canDownloadCvPdf: true,
    canDownloadApplicationLetterPdf: true,
  },
};

/**
 * Get a plan by its ID.
 */
export function getPlan(planId: PlanId): SubscriptionPlan {
  return SUBSCRIPTION_PLANS[planId];
}

export function resolvePlanId(
  planId: PlanId | string | null | undefined
): PlanId {
  if (planId === "pro") {
    return "pro";
  }
  if (planId === "max") {
    return "max";
  }
  return "free";
}

/**
 * Get all available plans as an array.
 */
export function getAllPlans(): SubscriptionPlan[] {
  return Object.values(SUBSCRIPTION_PLANS);
}

export function isUnlimitedLimit(value: number): boolean {
  return value < 0;
}

export function getDownloadLimit(
  planId: PlanId,
  kind: DownloadKind
): number {
  const plan = getPlan(planId);
  return kind === "cv"
    ? plan.cvDownloadsPerDay
    : plan.applicationLetterDownloadsPerDay;
}

export function getPdfDownloadLimit(
  planId: PlanId,
  kind: DownloadKind
): number {
  const plan = getPlan(planId);
  return kind === "cv"
    ? plan.cvPdfDownloadsPerDay
    : plan.applicationLetterPdfDownloadsPerDay;
}

export function getDocxDownloadLimit(
  planId: PlanId,
  kind: DownloadKind
): number {
  const plan = getPlan(planId);
  return kind === "cv"
    ? plan.cvDocxDownloadsPerDay
    : plan.applicationLetterDocxDownloadsPerDay;
}

export function canDownloadByFormat(
  planId: PlanId,
  kind: DownloadKind,
  format: DownloadFormat
): boolean {
  const plan = getPlan(planId);

  if (kind === "cv") {
    return format === "pdf" ? plan.canDownloadCvPdf : plan.canDownloadCvDocx;
  }

  return format === "pdf"
    ? plan.canDownloadApplicationLetterPdf
    : plan.canDownloadApplicationLetterDocx;
}

export function canDuplicateByKind(
  planId: PlanId,
  kind: DuplicateKind
): boolean {
  const plan = getPlan(planId);
  if (kind === "cv") {
    return plan.canDuplicateCvs;
  }
  if (kind === "application") {
    return plan.canDuplicateApplications;
  }
  return plan.canDuplicateApplicationLetters;
}

export function getCombinedDownloadLimit(planId: PlanId): number {
  const plan = getPlan(planId);

  if (
    isUnlimitedLimit(plan.cvDownloadsPerDay) ||
    isUnlimitedLimit(plan.applicationLetterDownloadsPerDay)
  ) {
    return -1;
  }

  return plan.cvDownloadsPerDay + plan.applicationLetterDownloadsPerDay;
}

export function buildUserSubscriptionState(
  planId: PlanId,
  subscriptionExpiresAt: Date | null = null
): UserSubscriptionState {
  return {
    subscriptionPlan: resolvePlanId(planId),
    subscriptionExpiresAt,
  };
}
