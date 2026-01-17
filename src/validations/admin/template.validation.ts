import { z } from "zod";
import {
  optionalBooleanSchema,
  optionalDateSchema,
} from "../query.util";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const dateOnlySchema = z
  .string()
  .trim()
  .regex(dateRegex, "Format tanggal: YYYY-MM-DD")
  .refine((value) => !Number.isNaN(Date.parse(value)), "Tanggal tidak valid");

export class TemplateValidation {
  static readonly LIST_QUERY = z
    .object({
      page: z.coerce.number().min(1).default(1),
      per_page: z.coerce.number().min(1).max(100).default(20),
      q: z.string().or(z.literal("")).optional(),
      sort_by: z
        .enum([
          "created_at",
          "updated_at",
          "name",
          "type",
          "language",
          "is_premium",
        ])
        .default("created_at"),
      sort_order: z.enum(["asc", "desc"]).default("desc"),
      type: z.enum(["cv", "application_letter"]).optional(),
      language: z.enum(["en", "id"]).optional(),
      is_premium: optionalBooleanSchema,
      created_at_from: optionalDateSchema(dateOnlySchema),
      created_at_to: optionalDateSchema(dateOnlySchema),
      updated_at_from: optionalDateSchema(dateOnlySchema),
      updated_at_to: optionalDateSchema(dateOnlySchema),
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
        data.updated_at_from &&
        data.updated_at_to &&
        Date.parse(data.updated_at_from) > Date.parse(data.updated_at_to)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["updated_at_from"],
          message: "Tanggal mulai tidak boleh setelah tanggal selesai",
        });
      }
    });

  static readonly PAYLOAD = z.object({
    name: z.string().min(1).max(255),
    type: z.enum(["cv", "application_letter"]),
    language: z.enum(["en", "id"]).default("en"),
    path: z.string().min(1),
    preview: z.string().or(z.literal("")).optional(),
    is_premium: z.boolean().default(false),
  });

  static readonly MASS_DELETE = z.object({
    ids: z.array(z.string()).min(1, "Minimal satu ID harus dipilih"),
  });
}
