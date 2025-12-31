import { z } from "zod";
import { BlogStatus } from "../generated/prisma/client";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const dateOnlySchema = z
  .string()
  .trim()
  .regex(dateRegex, "Format tanggal: YYYY-MM-DD")
  .refine((value) => !Number.isNaN(Date.parse(value)), "Tanggal tidak valid");

const nullableString = (max = 255) =>
  z.string().trim().max(max).or(z.literal("")).nullable().optional();

const optionalString = (max = 255) => z.string().trim().min(1).max(max);

const payloadSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Judul wajib diisi")
    .max(255, "Maksimal 255 karakter"),

  excerpt: nullableString(500),
  content: z.string().trim().min(1, "Konten wajib diisi"),
  featured_image: nullableString(500),
  status: z.nativeEnum(BlogStatus),

  category_id: z.string().trim().min(1, "Kategori wajib diisi"),
  tag_ids: z.array(z.string().trim().min(1)).optional(),
});

const listQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1, "Halaman minimal 1").default(1),
    per_page: z.coerce
      .number()
      .int()
      .min(1, "Per halaman minimal 1")
      .max(100, "Per halaman maksimal 100")
      .default(20),
    q: optionalString(255).or(z.literal("")).optional(),
    sort_order: z.enum(["asc", "desc"]).default("desc"),
    sort_by: z
      .enum(["created_at", "updated_at", "published_at", "title", "views"])
      .default("published_at"),
    status: z.enum(["published"]).default("published"),
    category_id: optionalString().or(z.literal("")).optional(),
    tag_id: optionalString().or(z.literal("")).optional(),
    author_id: optionalString().or(z.literal("")).optional(),
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
        message: "Tanggal mulai tidak boleh setelah tanggal selesai",
      });
    }
  });

const relatedBlogsQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1, "Limit minimal 1")
    .max(20, "Limit maksimal 20")
    .default(4),
});

export class BlogValidation {
  static readonly PAYLOAD = payloadSchema;
  static readonly LIST_QUERY = listQuerySchema;
  static readonly RELATED_BLOGS_QUERY = relatedBlogsQuerySchema;
}

export type BlogPayloadInput = z.infer<typeof BlogValidation.PAYLOAD>;

export type BlogListQuery = z.infer<typeof BlogValidation.LIST_QUERY>;

export type BlogRelatedBlogsQuery = z.infer<
  typeof BlogValidation.RELATED_BLOGS_QUERY
>;
