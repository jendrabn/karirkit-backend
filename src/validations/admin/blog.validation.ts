import { z } from "zod";
import {
  commaSeparatedStringSchema,
  optionalDateSchema,
  optionalNumberSchema,
} from "../query.util";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const dateOnlySchema = z
  .string()
  .trim()
  .regex(dateRegex, "Format tanggal: YYYY-MM-DD")
  .refine((value) => !Number.isNaN(Date.parse(value)), "Tanggal tidak valid");

export class BlogValidation {
  static readonly LIST_QUERY = z
    .object({
      page: z.coerce.number().min(1).default(1),
      per_page: z.coerce.number().min(1).max(100).default(20),
      q: z.string().or(z.literal("")).optional(),
      sort_by: z
        .enum([
          "created_at",
          "updated_at",
          "published_at",
          "title",
          "views",
          "read_time",
        ])
        .default("created_at"),
      sort_order: z.enum(["asc", "desc"]).default("desc"),
      status: z.enum(["draft", "published", "archived"]).optional(),
      category_id: z.string().or(z.literal("")).optional(),
      user_id: z.string().or(z.literal("")).optional(),
      tag_id: commaSeparatedStringSchema.optional(),
      published_at_from: optionalDateSchema(dateOnlySchema),
      published_at_to: optionalDateSchema(dateOnlySchema),
      created_at_from: optionalDateSchema(dateOnlySchema),
      created_at_to: optionalDateSchema(dateOnlySchema),
      read_time_from: optionalNumberSchema(z.number().int().nonnegative()),
      read_time_to: optionalNumberSchema(z.number().int().nonnegative()),
      views_from: optionalNumberSchema(z.number().int().nonnegative()),
      views_to: optionalNumberSchema(z.number().int().nonnegative()),
    })
    .superRefine((data, ctx) => {
      if (
        data.published_at_from &&
        data.published_at_to &&
        Date.parse(data.published_at_from) > Date.parse(data.published_at_to)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["published_at_from"],
          message: "Tanggal mulai tidak boleh setelah tanggal selesai",
        });
      }

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
        data.read_time_from !== undefined &&
        data.read_time_to !== undefined &&
        data.read_time_from > data.read_time_to
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["read_time_from"],
          message: "Read time minimal tidak boleh lebih besar dari maksimal",
        });
      }

      if (
        data.views_from !== undefined &&
        data.views_to !== undefined &&
        data.views_from > data.views_to
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["views_from"],
          message: "Views minimal tidak boleh lebih besar dari maksimal",
        });
      }
    });

  static readonly PAYLOAD = z.object({
    title: z.string().min(1).max(255),

    excerpt: z.string().or(z.literal("")).nullable().optional(),
    content: z.string().min(1),
    featured_image: z.string().or(z.literal("")).nullable().optional(),
    status: z.enum(["draft", "published", "archived"]),

    category_id: z.string().min(1),
    author_id: z.string().min(1),
    tag_ids: z.array(z.string()).optional(),
  });

  static readonly MASS_DELETE = z.object({
    ids: z.array(z.string()).min(1, "Minimal satu ID harus dipilih"),
  });
}
