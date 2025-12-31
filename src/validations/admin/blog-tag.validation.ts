import { z } from "zod";

export class BlogTagValidation {
  static readonly LIST_QUERY = z.object({
    page: z.coerce.number().min(1).default(1),
    per_page: z.coerce.number().min(1).max(100).default(20),
    q: z.string().or(z.literal("")).optional(),
    sort_by: z.enum(["created_at", "updated_at", "name"]).default("name"),
    sort_order: z.enum(["asc", "desc"]).default("asc"),
  });

  static readonly PAYLOAD = z.object({
    name: z.string().min(1).max(255),
  });

  static readonly MASS_DELETE = z.object({
    ids: z.array(z.string()).min(1, "Minimal satu ID harus dipilih"),
  });
}
