export type PlanId = 'free' | 'pro' | 'max';

export type AiImprovementKind = "cv" | "application_letter";

export interface SubscriptionPlan {
  id: PlanId;
  name: string;
  price: number;
  durationDays: number;
  maxCvs: number;
  maxApplicationLetters: number;
  maxApplications: number;
  maxDocumentStorageBytes: number;
  maxCvPdfDownloads: number;
  maxCvDocxDownloads: number;
  maxLetterPdfDownloads: number;
  maxLetterDocxDownloads: number;
  maxCvAiImprovements: number;
  maxApplicationLetterAiImprovements: number;
  canUsePremiumCvTemplates: boolean;
  canUsePremiumApplicationLetterTemplates: boolean;
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
    maxCvs: 10,
    maxApplicationLetters: 20,
    maxApplications: 100,
    maxDocumentStorageBytes: 52428800,
    maxCvPdfDownloads: 10,
    maxCvDocxDownloads: 3,
    maxLetterPdfDownloads: 10,
    maxLetterDocxDownloads: 3,
    maxCvAiImprovements: 10,
    maxApplicationLetterAiImprovements: 20,
    canUsePremiumCvTemplates: false,
    canUsePremiumApplicationLetterTemplates: false,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 25000,
    durationDays: 30,
    maxCvs: 30,
    maxApplicationLetters: 60,
    maxApplications: 500,
    maxDocumentStorageBytes: 209715200,
    maxCvPdfDownloads: 30,
    maxCvDocxDownloads: 10,
    maxLetterPdfDownloads: 30,
    maxLetterDocxDownloads: 10,
    maxCvAiImprovements: 50,
    maxApplicationLetterAiImprovements: 100,
    canUsePremiumCvTemplates: true,
    canUsePremiumApplicationLetterTemplates: true,
  },
  max: {
    id: 'max',
    name: 'Max',
    price: 50000,
    durationDays: 30,
    maxCvs: 75,
    maxApplicationLetters: 150,
    maxApplications: 1250,
    maxDocumentStorageBytes: 524288000,
    maxCvPdfDownloads: 75,
    maxCvDocxDownloads: 25,
    maxLetterPdfDownloads: 75,
    maxLetterDocxDownloads: 25,
    maxCvAiImprovements: 200,
    maxApplicationLetterAiImprovements: 300,
    canUsePremiumCvTemplates: true,
    canUsePremiumApplicationLetterTemplates: true,
  },
};

const PLAN_RANK: Record<PlanId, number> = {
  free: 0,
  pro: 1,
  max: 2,
};

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

export function getPlanRank(planId: PlanId): number {
  return PLAN_RANK[planId];
}

export function getAllPlans(): SubscriptionPlan[] {
  return Object.values(SUBSCRIPTION_PLANS);
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
