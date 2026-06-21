import { SubscriptionStatus } from "../generated/prisma/client";
import { prisma } from "../config/prisma.config";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const getPeriodStart = async (
  userId: string
): Promise<Date> => {
  const activeSubscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: SubscriptionStatus.paid,
      OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
    },
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    select: { paidAt: true },
  });

  return activeSubscription?.paidAt ?? new Date(Date.now() - THIRTY_DAYS_MS);
};
