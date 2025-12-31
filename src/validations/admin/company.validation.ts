import { z } from "zod";

export class CompanyValidation {
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

    description: z.string().optional(),
    logo: z.string().nullable().optional(),
    employee_size: z
      .enum([
        "one_to_ten",
        "eleven_to_fifty",
        "fifty_one_to_two_hundred",
        "two_hundred_one_to_five_hundred",
        "five_hundred_plus",
      ])
      .optional(),
    business_sector: z
      .string()
      .max(255, "Sektor bisnis maksimal 255 karakter")
      .optional(),
    website_url: z
      .union([
        z.literal("").transform(() => null),
        z.string().url("URL tidak valid").nullable(),
      ])
      .optional(),
  });

  static readonly UPDATE = z.object({
    name: z
      .string()
      .min(3, "Nama minimal 3 karakter")
      .max(255, "Nama maksimal 255 karakter")
      .optional(),

    description: z.string().optional(),
    logo: z.string().nullable().optional(),
    employee_size: z
      .enum([
        "one_to_ten",
        "eleven_to_fifty",
        "fifty_one_to_two_hundred",
        "two_hundred_one_to_five_hundred",
        "five_hundred_plus",
      ])
      .optional(),
    business_sector: z
      .string()
      .max(255, "Sektor bisnis maksimal 255 karakter")
      .optional(),
    website_url: z
      .union([
        z.literal("").transform(() => null),
        z.string().url("URL tidak valid").nullable(),
      ])
      .optional(),
  });

  static readonly MASS_DELETE = z.object({
    ids: z.array(z.string()).min(1, "Minimal satu ID harus dipilih"),
  });

  static readonly ID_PARAM = z.object({
    id: z.string().uuid("ID harus berupa UUID yang valid"),
  });

  static readonly SLUG_PARAM = z.object({
    slug: z.string().min(1, "Slug harus diisi"),
  });
}
