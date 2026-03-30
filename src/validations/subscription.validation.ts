import { z } from "zod";

const planIdSchema = z.enum(["free", "pro", "max"]);

export const MidtransNotificationSchema = z
  .object({
    order_id: z.string().trim().min(1, "Order ID wajib diisi"),
    status_code: z.union([z.string(), z.number()]).optional(),
    transaction_status: z.string().trim().min(1, "Status transaksi wajib diisi"),
    payment_type: z.string().trim().optional().nullable(),
    fraud_status: z.string().trim().optional().nullable(),
    gross_amount: z.union([z.string(), z.number()]),
    signature_key: z.string().trim().optional().nullable(),
  })
  .passthrough();

export class SubscriptionValidation {
  static readonly CREATE_ORDER = z.object({
    planId: planIdSchema,
  });
}

export type CreateSubscriptionOrderInput = z.infer<
  typeof SubscriptionValidation.CREATE_ORDER
>;
export type MidtransNotificationInput = z.infer<
  typeof MidtransNotificationSchema
>;
