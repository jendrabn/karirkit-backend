import { z } from "zod";
import {
  optionalDateSchema,
  optionalNumberSchema,
} from "../query.util";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const dateTimeSchema = z.string().datetime("Format tanggal tidak valid");
const manualPlanSchema = z.enum(["pro", "max"]);
const manualStatusSchema = z.enum(["pending", "paid"]);

const dateOnlySchema = z
  .string()
  .trim()
  .regex(dateRegex, "Format tanggal: YYYY-MM-DD")
  .refine((value) => !Number.isNaN(Date.parse(value)), "Tanggal tidak valid");

const parseCommaSeparated = (value: unknown): string[] | undefined => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const values = Array.isArray(value) ? value : [value];
  return values
    .flatMap((entry) =>
      typeof entry === "string"
        ? entry
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean)
        : []
    )
    .filter(Boolean);
};

export class SubscriptionAdminValidation {
  static readonly LIST_QUERY = z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      per_page: z.coerce.number().int().min(1).max(100).default(20),
      sort_by: z
        .enum(["created_at", "updated_at", "paid_at", "expires_at", "amount"])
        .default("created_at"),
      sort_order: z.enum(["asc", "desc"]).default("desc"),
      status: z.preprocess(
        parseCommaSeparated,
        z.array(z.enum(["pending", "paid", "expired", "failed", "cancelled"]))
      ).optional(),
      plan: z.preprocess(
        parseCommaSeparated,
        z.array(z.enum(["free", "pro", "max"]))
      ).optional(),
      user_id: z.string().uuid("ID user tidak valid").optional(),
      created_at_from: optionalDateSchema(dateOnlySchema),
      created_at_to: optionalDateSchema(dateOnlySchema),
      amount_from: optionalNumberSchema(z.number().int().nonnegative()),
      amount_to: optionalNumberSchema(z.number().int().nonnegative()),
    })
    .superRefine((data, ctx) => {
      if (
        data.created_at_from &&
        data.created_at_to &&
        Date.parse(data.created_at_from) > Date.parse(data.created_at_to)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["created_at_from"],
          message: "Tanggal mulai tidak boleh setelah tanggal selesai",
        });
      }

      if (
        data.amount_from !== undefined &&
        data.amount_to !== undefined &&
        data.amount_from > data.amount_to
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["amount_from"],
          message: "Amount minimal tidak boleh lebih besar dari maksimal",
        });
      }
    });

  static readonly CREATE_MANUAL = z.object({
    user_id: z.string().uuid("ID user tidak valid"),
    plan: manualPlanSchema,
    status: manualStatusSchema.default("paid"),
    amount: optionalNumberSchema(z.number().int().nonnegative()),
    paid_at: optionalDateSchema(dateTimeSchema),
  });
}

export type AdminSubscriptionListQuery = z.infer<
  typeof SubscriptionAdminValidation.LIST_QUERY
>;
export type AdminCreateSubscriptionInput = z.infer<
  typeof SubscriptionAdminValidation.CREATE_MANUAL
>;
