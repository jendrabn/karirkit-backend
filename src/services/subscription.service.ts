import crypto from "crypto";
import type { Prisma } from "../generated/prisma/client";
import type {
  SubscriptionOrderByWithRelationInput,
  SubscriptionWhereInput,
} from "../generated/prisma/models/Subscription";
import {
  PlanId as DbPlanId,
  SubscriptionStatus,
} from "../generated/prisma/client";
import { prisma } from "../config/prisma.config";
import env from "../config/env.config";
import {
  getAllPlans,
  getPlan,
  type PlanId as ConfigPlanId,
  resolvePlanId,
} from "../config/subscription-plans.config";
import { ResponseError } from "../utils/response-error.util";
import { validate } from "../utils/validate.util";
import {
  MidtransNotificationSchema,
  SubscriptionValidation,
  type CreateSubscriptionOrderInput,
  type MidtransNotificationInput,
} from "../validations/subscription.validation";
import {
  SubscriptionAdminValidation,
  type AdminCreateSubscriptionInput,
  type AdminSubscriptionListQuery,
} from "../validations/admin/subscription.validation";

const midtransClient =
  require("midtrans-client") as typeof import("midtrans-client");

type MidtransTransactionResponse = {
  token: string;
  redirect_url: string;
};

type CurrentSubscriptionResult = {
  id: string | null;
  plan: ConfigPlanId;
  status: string;
  amount: number;
  paidAt: string | null;
  expiresAt: string | null;
  midtransOrderId: string | null;
  midtransPaymentType: string | null;
  currentLimits: {
    maxCvs: number;
    maxApplications: number;
    maxApplicationLetters: number;
    maxDocumentStorageBytes: number;
    downloads: {
      cvPerDay: number;
      applicationLetterPerDay: number;
      cvPdfPerDay: number;
      applicationLetterPdfPerDay: number;
    };
  };
  currentFeatures: {
    canManageDocuments: boolean;
    canUsePremiumCvTemplates: boolean;
    canUsePremiumApplicationLetterTemplates: boolean;
    canUsePremiumTemplates: boolean;
    canDuplicateCvs: boolean;
    canDuplicateApplications: boolean;
    canDuplicateApplicationLetters: boolean;
    canDownloadCvPdf: boolean;
    canDownloadApplicationLetterPdf: boolean;
  };
};

type AdminSubscriptionResult = {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
  };
  plan: ConfigPlanId;
  status: string;
  amount: number;
  midtransOrderId: string;
  midtransToken: string | null;
  midtransPaymentType: string | null;
  paidAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const toDbPlanId = (planId: ConfigPlanId): DbPlanId => {
  switch (planId) {
    case "free":
      return DbPlanId.free;
    case "pro":
      return DbPlanId.pro;
    case "max":
      return DbPlanId.max;
  }
};

const toConfigPlanId = (planId: DbPlanId | string): ConfigPlanId =>
  resolvePlanId(planId);

export class SubscriptionService {
  static getPlans() {
    return getAllPlans();
  }

  static async createManualSubscription(
    request: unknown
  ): Promise<AdminSubscriptionResult> {
    const payload: AdminCreateSubscriptionInput = validate(
      SubscriptionAdminValidation.CREATE_MANUAL,
      request
    );

    const user = await prisma.user.findUnique({
      where: { id: payload.user_id },
      select: { id: true },
    });

    if (!user) {
      throw new ResponseError(404, "Pengguna tidak ditemukan");
    }

    const plan = getPlan(payload.plan);
    const amount = payload.amount ?? plan.price;
    const now = new Date();

    if (payload.status === "pending") {
      const existingPending = await prisma.subscription.findFirst({
        where: {
          userId: payload.user_id,
          plan: toDbPlanId(payload.plan),
          status: SubscriptionStatus.pending,
        },
        select: { id: true },
      });

      if (existingPending) {
        throw new ResponseError(
          400,
          "Masih ada subscription pending untuk plan ini"
        );
      }
    }

    const orderId = `MANUAL-${payload.user_id}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    let createdId = "";

    await prisma.$transaction(async (tx) => {
      const paidAt =
        payload.status === "paid"
          ? payload.paid_at
            ? new Date(payload.paid_at)
            : now
          : null;
      const expiresAt =
        payload.status === "paid" && paidAt
          ? SubscriptionService.calculateExpirationDate(payload.plan, paidAt)
          : null;

      const created = await tx.subscription.create({
        data: {
          userId: payload.user_id,
          plan: toDbPlanId(payload.plan),
          status:
            payload.status === "paid"
              ? SubscriptionStatus.paid
              : SubscriptionStatus.pending,
          midtransOrderId: orderId,
          midtransToken: null,
          midtransPaymentType: null,
          amount,
          paidAt,
          expiresAt,
          createdAt: now,
          updatedAt: now,
        },
      });

      createdId = created.id;

      if (payload.status === "paid") {
        await tx.subscription.updateMany({
          where: {
            userId: payload.user_id,
            id: { not: created.id },
            status: SubscriptionStatus.paid,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          data: {
            status: SubscriptionStatus.expired,
            expiresAt: now,
            updatedAt: now,
          },
        });

        await SubscriptionService.syncUserLimitsTx(
          tx,
          payload.user_id,
          payload.plan,
          expiresAt
        );
      }
    });

    return SubscriptionService.getAdminSubscription(createdId);
  }

  static async getCurrentSubscription(
    userId: string
  ): Promise<CurrentSubscriptionResult> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        subscriptionPlan: true,
        subscriptionExpiresAt: true,
      },
    });

    if (!user) {
      throw new ResponseError(404, "Pengguna tidak ditemukan");
    }

    const activePaid = await prisma.subscription.findFirst({
      where: {
        userId,
        status: SubscriptionStatus.paid,
        OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
      },
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    });

    const pending = activePaid
      ? null
      : await prisma.subscription.findFirst({
          where: {
            userId,
            status: SubscriptionStatus.pending,
          },
          orderBy: [{ createdAt: "desc" }],
        });

    const subscription = activePaid ?? pending;
    const plan = getPlan(toConfigPlanId(user.subscriptionPlan));

    return {
      id: subscription?.id ?? null,
      plan: toConfigPlanId(user.subscriptionPlan),
      status: subscription?.status ?? "active",
      amount: subscription?.amount ?? 0,
      paidAt: subscription?.paidAt?.toISOString() ?? null,
      expiresAt:
        subscription?.expiresAt?.toISOString() ??
        user.subscriptionExpiresAt?.toISOString() ??
        null,
      midtransOrderId: subscription?.midtransOrderId ?? null,
      midtransPaymentType: subscription?.midtransPaymentType ?? null,
      currentLimits: {
        maxCvs: plan.maxCvs,
        maxApplications: plan.maxApplications,
        maxApplicationLetters: plan.maxApplicationLetters,
        maxDocumentStorageBytes: plan.maxDocumentStorageBytes,
        downloads: {
          cvPerDay: plan.cvDownloadsPerDay,
          applicationLetterPerDay: plan.applicationLetterDownloadsPerDay,
          cvPdfPerDay: plan.cvPdfDownloadsPerDay,
          applicationLetterPdfPerDay: plan.applicationLetterPdfDownloadsPerDay,
        },
      },
      currentFeatures: {
        canManageDocuments: plan.canManageDocuments,
        canUsePremiumCvTemplates: plan.canUsePremiumCvTemplates,
        canUsePremiumApplicationLetterTemplates:
          plan.canUsePremiumApplicationLetterTemplates,
        canUsePremiumTemplates: plan.canUsePremiumTemplates,
        canDuplicateCvs: plan.canDuplicateCvs,
        canDuplicateApplications: plan.canDuplicateApplications,
        canDuplicateApplicationLetters: plan.canDuplicateApplicationLetters,
        canDownloadCvPdf: plan.canDownloadCvPdf,
        canDownloadApplicationLetterPdf: plan.canDownloadApplicationLetterPdf,
      },
    };
  }

  static async createSubscriptionOrder(
    userId: string,
    request: unknown
  ): Promise<{
    subscriptionId: string;
    orderId: string;
    snapToken: string;
    snapUrl: string;
    amount: number;
    plan: ConfigPlanId;
  }> {
    const payload: CreateSubscriptionOrderInput = validate(
      SubscriptionValidation.CREATE_ORDER,
      request
    );

    if (payload.planId === "free") {
      throw new ResponseError(400, "Plan Free tidak memerlukan pembayaran");
    }

    if (!env.midtrans.serverKey || !env.midtrans.clientKey) {
      throw new ResponseError(503, "Konfigurasi Midtrans belum lengkap");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        subscriptionPlan: true,
        subscriptionExpiresAt: true,
      },
    });

    if (!user) {
      throw new ResponseError(404, "Pengguna tidak ditemukan");
    }

    const now = new Date();
    const currentPlan = toConfigPlanId(user.subscriptionPlan);
    if (
      currentPlan === payload.planId &&
      (!user.subscriptionExpiresAt || user.subscriptionExpiresAt >= now)
    ) {
      throw new ResponseError(
        400,
        "Anda sudah memiliki langganan aktif untuk plan ini"
      );
    }

    const existing = await prisma.subscription.findFirst({
      where: {
        userId,
        plan: toDbPlanId(payload.planId),
        OR: [
          { status: SubscriptionStatus.pending },
          {
            status: SubscriptionStatus.paid,
            OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
          },
        ],
      },
      select: { id: true },
    });

    if (existing) {
      throw new ResponseError(
        400,
        "Masih ada transaksi subscription untuk plan ini yang belum selesai"
      );
    }

    const plan = getPlan(payload.planId);
    const orderId = `SUB-${userId}-${Date.now()}`;
    const snap = new midtransClient.Snap({
      isProduction: env.midtrans.isProduction,
      serverKey: env.midtrans.serverKey,
      clientKey: env.midtrans.clientKey,
    });

    let transaction: MidtransTransactionResponse;
    try {
      transaction = (await snap.createTransaction({
        transaction_details: {
          order_id: orderId,
          gross_amount: plan.price,
        },
        item_details: [
          {
            id: plan.id,
            price: plan.price,
            quantity: 1,
            name: `KarirKit ${plan.name} Plan`,
          },
        ],
        customer_details: {
          first_name: user.name,
          email: user.email,
          phone: user.phone ?? undefined,
        },
      } as any)) as MidtransTransactionResponse;
    } catch (error) {
      throw new ResponseError(
        502,
        "Gagal membuat transaksi Midtrans",
        typeof (error as Error).message === "string"
          ? (error as Error).message
          : undefined
      );
    }

    const subscription = await prisma.subscription.create({
      data: {
        userId,
        plan: toDbPlanId(payload.planId),
        status: SubscriptionStatus.pending,
        midtransOrderId: orderId,
        midtransToken: transaction.token,
        amount: plan.price,
        createdAt: now,
        updatedAt: now,
      },
    });

    return {
      subscriptionId: subscription.id,
      orderId,
      snapToken: transaction.token,
      snapUrl: transaction.redirect_url,
      amount: plan.price,
      plan: payload.planId,
    };
  }

  static async handleMidtransNotification(request: unknown): Promise<void> {
    const payload: MidtransNotificationInput = validate(
      MidtransNotificationSchema,
      request
    );

    SubscriptionService.verifyMidtransSignature(payload);

    const subscription = await prisma.subscription.findUnique({
      where: { midtransOrderId: payload.order_id },
    });

    if (!subscription) {
      throw new ResponseError(404, "Subscription tidak ditemukan");
    }

    const normalizedStatus = SubscriptionService.mapTransactionStatus(payload);
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      if (normalizedStatus === SubscriptionStatus.paid) {
        const planId = toConfigPlanId(subscription.plan);
        const paidAt = subscription.paidAt ?? now;
        const expiresAt = SubscriptionService.calculateExpirationDate(
          planId,
          paidAt
        );

        await tx.subscription.update({
          where: { id: subscription.id },
          data: {
            status: SubscriptionStatus.paid,
            paidAt,
            expiresAt,
            midtransPaymentType: payload.payment_type ?? null,
            updatedAt: now,
          },
        });

        await tx.subscription.updateMany({
          where: {
            userId: subscription.userId,
            id: { not: subscription.id },
            status: SubscriptionStatus.paid,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          data: {
            status: SubscriptionStatus.expired,
            expiresAt: now,
            updatedAt: now,
          },
        });

        await SubscriptionService.syncUserLimitsTx(
          tx,
          subscription.userId,
          planId,
          expiresAt
        );
        return;
      }

      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          status: normalizedStatus,
          midtransPaymentType: payload.payment_type ?? null,
          updatedAt: now,
        },
      });
    });
  }

  static async cancelSubscription(
    userId: string,
    subscriptionId: string
  ): Promise<void> {
    const subscription = await prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        userId,
      },
    });

    if (!subscription) {
      throw new ResponseError(404, "Subscription tidak ditemukan");
    }

    if (subscription.status !== SubscriptionStatus.pending) {
      throw new ResponseError(
        400,
        "Hanya subscription dengan status pending yang dapat dibatalkan"
      );
    }

    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: SubscriptionStatus.cancelled,
        updatedAt: new Date(),
      },
    });
  }

  static async syncUserLimits(
    userId: string,
    planId: ConfigPlanId,
    subscriptionExpiresAt: Date | null
  ): Promise<void> {
    await SubscriptionService.syncUserLimitsTx(
      prisma,
      userId,
      planId,
      subscriptionExpiresAt
    );
  }

  static async expireSubscriptions(): Promise<{ expired_count: number }> {
    const now = new Date();
    const expired = await prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.paid,
        expiresAt: {
          lt: now,
        },
      },
      select: {
        id: true,
        userId: true,
      },
    });

    if (expired.length === 0) {
      return { expired_count: 0 };
    }

    const userIds = Array.from(new Set(expired.map((item) => item.userId)));

    await prisma.$transaction(async (tx) => {
      await tx.subscription.updateMany({
        where: {
          id: { in: expired.map((item) => item.id) },
        },
        data: {
          status: SubscriptionStatus.expired,
          updatedAt: now,
        },
      });

      for (const userId of userIds) {
        const activeReplacement = await tx.subscription.findFirst({
          where: {
            userId,
            status: SubscriptionStatus.paid,
            OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
          },
          orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
        });

        if (activeReplacement) {
          await SubscriptionService.syncUserLimitsTx(
            tx,
            userId,
            toConfigPlanId(activeReplacement.plan),
            activeReplacement.expiresAt ?? null
          );
          continue;
        }

        await SubscriptionService.syncUserLimitsTx(tx, userId, "free", null);
      }
    });

    return { expired_count: expired.length };
  }

  static async listAdminSubscriptions(
    query: unknown
  ): Promise<{
    items: AdminSubscriptionResult[];
    pagination: {
      page: number;
      per_page: number;
      total_items: number;
      total_pages: number;
    };
  }> {
    const filters: AdminSubscriptionListQuery = validate(
      SubscriptionAdminValidation.LIST_QUERY,
      query
    );

    const where: SubscriptionWhereInput = {};
    if (filters.status?.length) {
      where.status = { in: filters.status as SubscriptionStatus[] };
    }

    if (filters.plan?.length) {
      where.plan = { in: filters.plan.map((plan) => toDbPlanId(plan)) };
    }

    if (filters.user_id) {
      where.userId = filters.user_id;
    }

    if (filters.created_at_from || filters.created_at_to) {
      where.createdAt = {};
      if (filters.created_at_from) {
        where.createdAt.gte = new Date(
          `${filters.created_at_from}T00:00:00.000Z`
        );
      }
      if (filters.created_at_to) {
        where.createdAt.lte = new Date(
          `${filters.created_at_to}T23:59:59.999Z`
        );
      }
    }

    if (filters.amount_from !== undefined || filters.amount_to !== undefined) {
      where.amount = {};
      if (filters.amount_from !== undefined) {
        where.amount.gte = filters.amount_from;
      }
      if (filters.amount_to !== undefined) {
        where.amount.lte = filters.amount_to;
      }
    }

    const sortFieldMap = {
      created_at: "createdAt",
      updated_at: "updatedAt",
      paid_at: "paidAt",
      expires_at: "expiresAt",
      amount: "amount",
    } as const;

    const orderBy: SubscriptionOrderByWithRelationInput = {
      [sortFieldMap[filters.sort_by]]: filters.sort_order,
    };

    const [totalItems, records] = await Promise.all([
      prisma.subscription.count({ where }),
      prisma.subscription.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
        orderBy,
        skip: (filters.page - 1) * filters.per_page,
        take: filters.per_page,
      }),
    ]);

    const totalPages =
      totalItems === 0
        ? 0
        : Math.ceil(totalItems / Math.max(filters.per_page, 1));

    return {
      items: records.map((record) =>
        SubscriptionService.toAdminSubscription(record)
      ),
      pagination: {
        page: filters.page,
        per_page: filters.per_page,
        total_items: totalItems,
        total_pages: totalPages,
      },
    };
  }

  static async getAdminSubscription(
    id: string
  ): Promise<AdminSubscriptionResult> {
    const subscription = await prisma.subscription.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!subscription) {
      throw new ResponseError(404, "Subscription tidak ditemukan");
    }

    return SubscriptionService.toAdminSubscription(subscription);
  }

  static async manualApprove(id: string): Promise<void> {
    const subscription = await prisma.subscription.findUnique({
      where: { id },
    });

    if (!subscription) {
      throw new ResponseError(404, "Subscription tidak ditemukan");
    }

    if (subscription.status === SubscriptionStatus.paid) {
      return;
    }

    if (subscription.status !== SubscriptionStatus.pending) {
      throw new ResponseError(
        400,
        "Hanya subscription pending yang dapat di-approve manual"
      );
    }

    const now = new Date();
    const planId = toConfigPlanId(subscription.plan);
    const expiresAt = SubscriptionService.calculateExpirationDate(planId, now);

    await prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          status: SubscriptionStatus.paid,
          paidAt: now,
          expiresAt,
          updatedAt: now,
        },
      });

      await tx.subscription.updateMany({
        where: {
          userId: subscription.userId,
          id: { not: subscription.id },
          status: SubscriptionStatus.paid,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        data: {
          status: SubscriptionStatus.expired,
          expiresAt: now,
          updatedAt: now,
        },
      });

      await SubscriptionService.syncUserLimitsTx(
        tx,
        subscription.userId,
        planId,
        expiresAt
      );
    });
  }

  static async manualCancel(id: string): Promise<void> {
    const subscription = await prisma.subscription.findUnique({
      where: { id },
    });

    if (!subscription) {
      throw new ResponseError(404, "Subscription tidak ditemukan");
    }

    if (subscription.status === SubscriptionStatus.cancelled) {
      return;
    }

    if (
      subscription.status !== SubscriptionStatus.pending &&
      subscription.status !== SubscriptionStatus.paid
    ) {
      throw new ResponseError(
        400,
        "Hanya subscription pending atau paid yang dapat dibatalkan manual"
      );
    }

    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          status: SubscriptionStatus.cancelled,
          expiresAt:
            subscription.status === SubscriptionStatus.paid ? now : undefined,
          updatedAt: now,
        },
      });

      if (subscription.status === SubscriptionStatus.paid) {
        await SubscriptionService.syncUserToBestAvailablePlanTx(
          tx,
          subscription.userId,
          now
        );
      }
    });
  }

  static async markFailed(id: string): Promise<void> {
    const subscription = await prisma.subscription.findUnique({
      where: { id },
    });

    if (!subscription) {
      throw new ResponseError(404, "Subscription tidak ditemukan");
    }

    if (subscription.status === SubscriptionStatus.failed) {
      return;
    }

    if (subscription.status !== SubscriptionStatus.pending) {
      throw new ResponseError(
        400,
        "Hanya subscription pending yang dapat ditandai gagal"
      );
    }

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: SubscriptionStatus.failed,
        updatedAt: new Date(),
      },
    });
  }

  static async forceDowngradeToFree(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new ResponseError(404, "Pengguna tidak ditemukan");
    }

    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.subscription.updateMany({
        where: {
          userId,
          OR: [
            { status: SubscriptionStatus.pending },
            {
              status: SubscriptionStatus.paid,
              OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            },
          ],
        },
        data: {
          status: SubscriptionStatus.cancelled,
          expiresAt: now,
          updatedAt: now,
        },
      });

      await SubscriptionService.syncUserLimitsTx(tx, userId, "free", null);
    });
  }

  private static toAdminSubscription(
    subscription: {
      id: string;
      userId: string;
      user: {
        id: string;
        name: string;
        email: string;
        phone: string | null;
      };
      plan: DbPlanId;
      status: SubscriptionStatus;
      amount: number;
      midtransOrderId: string;
      midtransToken: string | null;
      midtransPaymentType: string | null;
      paidAt: Date | null;
      expiresAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    }
  ): AdminSubscriptionResult {
    return {
      id: subscription.id,
      userId: subscription.userId,
      user: {
        id: subscription.user.id,
        name: subscription.user.name,
        email: subscription.user.email,
        phone: subscription.user.phone,
      },
      plan: toConfigPlanId(subscription.plan),
      status: subscription.status,
      amount: subscription.amount,
      midtransOrderId: subscription.midtransOrderId,
      midtransToken: subscription.midtransToken ?? null,
      midtransPaymentType: subscription.midtransPaymentType ?? null,
      paidAt: subscription.paidAt?.toISOString() ?? null,
      expiresAt: subscription.expiresAt?.toISOString() ?? null,
      createdAt: subscription.createdAt.toISOString(),
      updatedAt: subscription.updatedAt.toISOString(),
    };
  }

  private static verifyMidtransSignature(
    payload: MidtransNotificationInput
  ): void {
    if (!env.midtrans.serverKey) {
      throw new ResponseError(503, "Konfigurasi Midtrans belum lengkap");
    }

    const signature = payload.signature_key?.trim();
    if (!signature) {
      throw new ResponseError(401, "Signature Midtrans tidak ditemukan");
    }

    const statusCode =
      typeof payload.status_code === "number"
        ? String(payload.status_code)
        : payload.status_code?.trim() ?? "";
    const grossAmount =
      typeof payload.gross_amount === "number"
        ? payload.gross_amount.toFixed(2)
        : String(payload.gross_amount);

    const expected = crypto
      .createHash("sha512")
      .update(
        `${payload.order_id}${statusCode}${grossAmount}${env.midtrans.serverKey}`
      )
      .digest("hex");

    if (signature !== expected) {
      throw new ResponseError(401, "Signature Midtrans tidak valid");
    }
  }

  private static mapTransactionStatus(
    payload: MidtransNotificationInput
  ): SubscriptionStatus {
    const transactionStatus = payload.transaction_status.toLowerCase();
    const fraudStatus = payload.fraud_status?.toLowerCase() ?? "";

    if (
      transactionStatus === "settlement" ||
      (transactionStatus === "capture" && fraudStatus === "accept")
    ) {
      return SubscriptionStatus.paid;
    }

    if (transactionStatus === "pending") {
      return SubscriptionStatus.pending;
    }

    if (transactionStatus === "cancel") {
      return SubscriptionStatus.cancelled;
    }

    if (
      transactionStatus === "expire" ||
      transactionStatus === "deny" ||
      transactionStatus === "failure"
    ) {
      return SubscriptionStatus.failed;
    }

    if (transactionStatus === "capture" && fraudStatus === "challenge") {
      return SubscriptionStatus.pending;
    }

    return SubscriptionStatus.failed;
  }

  private static calculateExpirationDate(
    planId: ConfigPlanId,
    paidAt: Date
  ): Date | null {
    const plan = getPlan(planId);
    if (plan.durationDays <= 0) {
      return null;
    }

    const expiresAt = new Date(paidAt);
    expiresAt.setDate(expiresAt.getDate() + plan.durationDays);
    return expiresAt;
  }

  private static async syncUserLimitsTx(
    tx: Prisma.TransactionClient | typeof prisma,
    userId: string,
    planId: ConfigPlanId,
    subscriptionExpiresAt: Date | null
  ): Promise<void> {
    await tx.user.update({
      where: { id: userId },
      data: {
        subscriptionPlan: toDbPlanId(planId),
        subscriptionExpiresAt,
        updatedAt: new Date(),
      },
    });
  }

  private static async syncUserToBestAvailablePlanTx(
    tx: Prisma.TransactionClient | typeof prisma,
    userId: string,
    now: Date
  ): Promise<void> {
    const activeReplacement = await tx.subscription.findFirst({
      where: {
        userId,
        status: SubscriptionStatus.paid,
        OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
      },
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    });

    if (activeReplacement) {
      await SubscriptionService.syncUserLimitsTx(
        tx,
        userId,
        toConfigPlanId(activeReplacement.plan),
        activeReplacement.expiresAt ?? null
      );
      return;
    }

    await SubscriptionService.syncUserLimitsTx(tx, userId, "free", null);
  }
}
