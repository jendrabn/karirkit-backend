import { z } from "zod";
import { ProjectType } from "../generated/prisma/client";
import {
  commaSeparatedNativeEnum,
  commaSeparatedStringSchema,
  optionalDateSchema,
  optionalNumberSchema,
} from "./query.util";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const dateOnlySchema = z
  .string()
  .trim()
  .regex(dateRegex, "Format tanggal: YYYY-MM-DD")
  .refine((value) => !Number.isNaN(Date.parse(value)), "Tanggal tidak valid");

const nullableString = (max = 255) =>
  z
    .string()
    .trim()
    .max(max, `Maksimal ${max} karakter`)
    .or(z.literal(""))
    .nullable()
    .optional();

const optionalString = (max = 255) =>
  z
    .string()
    .trim()
    .max(max, `Maksimal ${max} karakter`)
    .or(z.literal(""))
    .optional();

const slugSchema = z
  .string()
  .trim()
  .min(1, "Slug wajib diisi")
  .max(255, "Maksimal 255 karakter")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/i,
    "Slug hanya boleh huruf, angka, dan tanda hubung"
  );

const monthSchema = z
  .number()
  .int()
  .min(1, "Bulan minimal 1")
  .max(12, "Bulan maksimal 12");
const yearSchema = z
  .number()
  .int()
  .min(1900, "Tahun minimal 1900")
  .max(2100, "Tahun maksimal 2100");

const mediaSchema = z.object({
  path: z
    .string()
    .trim()
    .min(1, "Path media wajib diisi")
    .max(255, "Maksimal 255 karakter"),
  caption: z
    .string()
    .trim()
    .max(255, "Maksimal 255 karakter")
    .nullable()
    .optional(),
});

const payloadSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Judul wajib diisi")
    .max(255, "Maksimal 255 karakter"),
  sort_description: z
    .string()
    .trim()
    .min(1, "Deskripsi singkat wajib diisi")
    .max(255, "Maksimal 255 karakter"),
  description: z
    .string()
    .trim()
    .min(1, "Deskripsi wajib diisi")
    .max(10000, "Maksimal 10000 karakter"),
  role_title: z
    .string()
    .trim()
    .min(1, "Judul peran wajib diisi")
    .max(255, "Maksimal 255 karakter"),
  project_type: z.nativeEnum(ProjectType),
  industry: z
    .string()
    .trim()
    .min(1, "Industri wajib diisi")
    .max(255, "Maksimal 255 karakter"),
  month: monthSchema,
  year: yearSchema,
  live_url: nullableString(2000),
  repo_url: nullableString(2000),
  cover: z
    .string()
    .trim()
    .min(1, "Cover wajib diisi")
    .max(255, "Maksimal 255 karakter")
    .nullable()
    .optional(),
  tools: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Tool wajib diisi")
        .max(255, "Maksimal 255 karakter")
    )
    .optional(),
  medias: z.array(mediaSchema).optional(),
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
    q: optionalString(255),
    sort_order: z.enum(["asc", "desc"]).default("desc"),
    sort_by: z
      .enum([
        "created_at",
        "updated_at",
        "year",
        "month",
        "title",
        "industry",
      ])
      .default("created_at"),
    project_type: commaSeparatedNativeEnum(ProjectType).optional(),
    industry: commaSeparatedStringSchema.optional(),
    year: optionalNumberSchema(yearSchema),
    year_from: optionalNumberSchema(yearSchema),
    year_to: optionalNumberSchema(yearSchema),
    month: optionalNumberSchema(monthSchema),
    month_from: optionalNumberSchema(monthSchema),
    month_to: optionalNumberSchema(monthSchema),
    created_at_from: optionalDateSchema(dateOnlySchema),
    created_at_to: optionalDateSchema(dateOnlySchema),
    tools_name: commaSeparatedStringSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.year_from !== undefined && data.year_to !== undefined) {
      if (data.year_from > data.year_to) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["year_from"],
          message: "Tahun mulai tidak boleh setelah tahun selesai",
        });
      }
    }

    if (data.month_from !== undefined && data.month_to !== undefined) {
      if (data.month_from > data.month_to) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["month_from"],
          message: "Bulan mulai tidak boleh setelah bulan selesai",
        });
      }
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

const massDeleteSchema = z.object({
  ids: z.array(z.string()).min(1, "Minimal satu ID harus dipilih"),
});

export class PortfolioValidation {
  static readonly PAYLOAD = payloadSchema;
  static readonly LIST_QUERY = listQuerySchema;
  static readonly MASS_DELETE = massDeleteSchema;
}

export type PortfolioPayloadInput = z.infer<typeof PortfolioValidation.PAYLOAD>;
export type PortfolioListQuery = z.infer<typeof PortfolioValidation.LIST_QUERY>;
export type PortfolioMediaPayloadInput = z.infer<typeof mediaSchema>;
export type MassDeleteInput = z.infer<typeof PortfolioValidation.MASS_DELETE>;
