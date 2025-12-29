import { z } from "zod";

export class JobRoleValidation {
  static readonly LIST_QUERY = z.object({
    page: z.coerce.number().min(1).default(1),
    per_page: z.coerce.number().min(1).max(100).default(20),
    q: z.string().optional(),
    sort_by: z.enum(["created_at", "name"]).default("created_at"),
    sort_order: z.enum(["asc", "desc"]).default("desc"),
  });

  static readonly CREATE = z.object({
    name: z
      .string()
      .min(3, "Nama minimal 3 karakter")
      .max(255, "Nama maksimal 255 karakter"),
    slug: z
      .string()
      .min(3, "Slug minimal 3 karakter")
      .max(255, "Slug maksimal 255 karakter"),
  });

  static readonly UPDATE = z.object({
    name: z
      .string()
      .min(3, "Nama minimal 3 karakter")
      .max(255, "Nama maksimal 255 karakter")
      .optional(),
    slug: z
      .string()
      .min(3, "Slug minimal 3 karakter")
      .max(255, "Slug maksimal 255 karakter")
      .optional(),
  });

  static readonly MASS_DELETE = z.object({
    ids: z.array(z.string()).min(1, "Minimal satu ID harus dipilih"),
  });

  static readonly ID_PARAM = z.object({
    id: z.string().uuid("ID harus berupa UUID yang valid"),
  });
}
