import { prisma } from "../config/prisma.config";

export const markUserLastLogin = async (userId: string) =>
  prisma.user.update({
    where: { id: userId },
    data: {
      lastLoginAt: new Date(),
    },
  });
