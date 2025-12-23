import { z } from "zod";

export class TemplateValidation {
  static readonly LIST_QUERY = z.object({
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
    is_premium: z.coerce.boolean().optional(),
  });

  static readonly PAYLOAD = z.object({
    name: z.string().min(1).max(255),
    slug: z.string().min(1).max(255),
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
