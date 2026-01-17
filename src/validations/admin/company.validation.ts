import { z } from "zod";
import {
  commaSeparatedEnumSchema,
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

export class CompanyValidation {
  static readonly LIST_QUERY = z
    .object({
      page: z.coerce.number().min(1).default(1),
      per_page: z.coerce.number().min(1).max(100).default(20),
      q: z.string().optional(),
      sort_by: z
        .enum(["created_at", "updated_at", "name", "employee_size", "job_count"])
        .default("created_at"),
      sort_order: z.enum(["asc", "desc"]).default("desc"),
      employee_size: commaSeparatedEnumSchema([
        "one_to_ten",
        "eleven_to_fifty",
        "fifty_one_to_two_hundred",
        "two_hundred_one_to_five_hundred",
        "five_hundred_plus",
      ]).optional(),
      business_sector: commaSeparatedStringSchema.optional(),
      job_count_from: optionalNumberSchema(z.number().int().nonnegative()),
      job_count_to: optionalNumberSchema(z.number().int().nonnegative()),
      created_at_from: optionalDateSchema(dateOnlySchema),
      created_at_to: optionalDateSchema(dateOnlySchema),
    })
    .superRefine((data, ctx) => {
      if (
        data.job_count_from !== undefined &&
        data.job_count_to !== undefined &&
        data.job_count_from > data.job_count_to
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["job_count_from"],
          message: "Jumlah job minimal tidak boleh lebih besar dari maksimal",
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
