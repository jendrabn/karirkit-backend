import { z } from "zod";
import { BlogStatus } from "../generated/prisma/client";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const dateOnlySchema = z
  .string()
  .trim()
  .regex(dateRegex, "Date must use YYYY-MM-DD format")
  .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date value");

const nullableString = (max = 255) =>
  z.string().trim().min(1).max(max).nullable().optional();

const optionalString = (max = 255) => z.string().trim().min(1).max(max);

const payloadSchema = z.object({
  title: z.string().trim().min(1).max(255),
  slug: z.string().trim().min(1).max(255),
  excerpt: nullableString(500),
  content: z.string().trim().min(1),
  featured_image: nullableString(500),
  status: z.nativeEnum(BlogStatus),
  read_time: z.number().int().nonnegative().optional(),
  category_id: z.string().trim().min(1),
  tag_ids: z.array(z.string().trim().min(1)).optional(),
});

const listQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    per_page: z.coerce.number().int().min(1).max(100).default(20),
    q: optionalString(255).optional(),
    sort_order: z.enum(["asc", "desc"]).default("desc"),
    sort_by: z
      .enum(["created_at", "updated_at", "published_at", "title", "views"])
      .default("published_at"),
    status: z.enum(["published"]).default("published"),
    category_id: optionalString().optional(),
    tag_id: optionalString().optional(),
    author_id: optionalString().optional(),
    published_from: dateOnlySchema.optional(),
    published_to: dateOnlySchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.published_from &&
      data.published_to &&
      Date.parse(data.published_from) > Date.parse(data.published_to)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["published_from"],
        message: "published_from cannot be after published_to",
      });
    }
  });

export class BlogValidation {
  static readonly PAYLOAD = payloadSchema;
  static readonly LIST_QUERY = listQuerySchema;
}

export type BlogPayloadInput = z.infer<typeof BlogValidation.PAYLOAD>;

export type BlogListQuery = z.infer<typeof BlogValidation.LIST_QUERY>;
