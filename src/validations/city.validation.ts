import { z } from "zod";

export class CityValidation {
  static readonly LIST_QUERY = z.object({
    page: z.coerce.number().min(1).default(1),
    per_page: z.coerce.number().min(1).max(100).default(20),
    q: z.string().optional(),
    province_id: z
      .string()
      .uuid("ID provinsi harus berupa UUID yang valid")
      .optional(),
    sort_by: z.enum(["created_at", "name"]).default("created_at"),
    sort_order: z.enum(["asc", "desc"]).default("desc"),
  });
}
