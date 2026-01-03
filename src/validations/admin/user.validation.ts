import { z } from "zod";

export class UserValidation {
  static readonly LIST_QUERY = z.object({
    page: z.coerce.number().min(1).default(1),
    per_page: z.coerce.number().min(1).max(100).default(20),
    q: z.string().or(z.literal("")).optional(),
    sort_by: z
      .enum(["created_at", "updated_at", "name", "username", "email", "role"])
      .default("created_at"),
    sort_order: z.enum(["asc", "desc"]).default("desc"),
    role: z.enum(["user", "admin"]).optional(),
    created_from: z.string().or(z.literal("")).optional(),
    created_to: z.string().or(z.literal("")).optional(),
  });

  static readonly CREATE = z.object({
    name: z
      .string()
      .min(3, "Nama minimal 3 karakter")
      .max(100, "Nama maksimal 100 karakter"),
    username: z
      .string()
      .min(3, "Username minimal 3 karakter")
      .max(100, "Username maksimal 100 karakter"),
    email: z
      .string()
      .email("Format email tidak valid")
      .min(5, "Email minimal 5 karakter")
      .max(100, "Email maksimal 100 karakter"),
    password: z
      .string()
      .min(6, "Password minimal 6 karakter")
      .max(100, "Password maksimal 100 karakter"),
    phone: z
      .string()
      .regex(/^(?:\+62|62|0)\d{8,13}$/, "Format: 08xxx, 62xxx, atau +62xxx")
      .or(z.literal(""))
      .nullable()
      .optional(),
    role: z.enum(["user", "admin"]).default("user"),
    avatar: z.string().or(z.literal("")).nullable().optional(),
    daily_download_limit: z.coerce
      .number()
      .min(0)
      .max(1000)
      .default(10)
      .optional(),
    document_storage_limit: z.coerce
      .number()
      .min(0)
      .max(10 * 1024)
      .default(100)
      .optional(),
  });

  static readonly UPDATE = z.object({
    name: z
      .string()
      .min(3, "Nama minimal 3 karakter")
      .max(100, "Nama maksimal 100 karakter")
      .or(z.literal(""))
      .optional(),
    username: z
      .string()
      .min(3, "Username minimal 3 karakter")
      .max(100, "Username maksimal 100 karakter")
      .or(z.literal(""))
      .optional(),
    email: z
      .string()
      .email("Format email tidak valid")
      .min(5, "Email minimal 5 karakter")
      .max(100, "Email maksimal 100 karakter")
      .or(z.literal(""))
      .optional(),
    phone: z
      .string()
      .regex(/^(?:\+62|62|0)\d{8,13}$/, "Format: 08xxx, 62xxx, atau +62xxx")
      .or(z.literal(""))
      .nullable()
      .optional(),
    role: z.enum(["user", "admin"]).optional(),
    avatar: z.string().or(z.literal("")).nullable().optional(),
    daily_download_limit: z.coerce.number().min(0).max(1000).optional(),
    document_storage_limit: z.coerce
      .number()
      .min(0)
      .max(10 * 1024)
      .optional(),
    status: z.enum(["active", "suspended", "banned"]).optional(),
    status_reason: z.string().max(500).or(z.literal("")).nullable().optional(),
    suspended_until: z
      .string()
      .or(z.literal(""))
      .nullable()
      .optional()
      .refine(
        (value) => {
          if (!value) {
            return true;
          }
          return !Number.isNaN(Date.parse(value));
        },
        { message: "Format tanggal penangguhan tidak valid" }
      ),
  });

  static readonly MASS_DELETE = z.object({
    ids: z.array(z.string()).min(1, "Minimal satu ID harus dipilih"),
  });
}
