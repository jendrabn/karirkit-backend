import { z } from "zod";

export class BlogValidation {
  static readonly LIST_QUERY = z.object({
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
        "status",
      ])
      .default("created_at"),
    sort_order: z.enum(["asc", "desc"]).default("desc"),
    status: z.enum(["draft", "published", "archived"]).optional(),
    category_id: z.string().or(z.literal("")).optional(),
    author_id: z.string().or(z.literal("")).optional(),
    published_from: z.string().or(z.literal("")).optional(),
    published_to: z.string().or(z.literal("")).optional(),
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
