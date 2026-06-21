import { SubscriptionStatus } from "../generated/prisma/client";
import { prisma } from "../config/prisma.config";

export const getPeriodStart = async (
  userId: string
): Promise<Date> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true },
  });

  const activeSubscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: SubscriptionStatus.paid,
      OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
    },
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    select: { paidAt: true },
  });

  return activeSubscription?.paidAt ?? user!.createdAt;
};
