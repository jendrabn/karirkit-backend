import { z } from "zod";
import { ProjectType } from "../generated/prisma/client";

const nullableString = (max = 255) =>
  z.string().trim().min(1).max(max).nullable().optional();

const optionalString = (max = 255) =>
  z.string().trim().min(1).max(max).optional();

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/i,
    "Slug hanya boleh berisi huruf, angka, dan tanda hubung"
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
  path: z.string().trim().min(1).max(255),
  caption: z.string().trim().max(255).nullable().optional(),
});

const payloadSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Judul wajib diisi")
    .max(255, "Judul maksimal 255 karakter"),
  slug: slugSchema,
  sort_description: z
    .string()
    .trim()
    .min(1, "Deskripsi singkat wajib diisi")
    .max(255, "Deskripsi singkat maksimal 255 karakter"),
  description: z
    .string()
    .trim()
    .min(1, "Deskripsi wajib diisi")
    .max(10000, "Deskripsi maksimal 10000 karakter"),
  role_title: z
    .string()
    .trim()
    .min(1, "Judul peran wajib diisi")
    .max(255, "Judul peran maksimal 255 karakter"),
  project_type: z.nativeEnum(ProjectType),
  industry: z
    .string()
    .trim()
    .min(1, "Industri wajib diisi")
    .max(255, "Industri maksimal 255 karakter"),
  month: monthSchema,
  year: yearSchema,
  live_url: nullableString(2000),
  repo_url: nullableString(2000),
  cover: z.string().trim().min(1).max(255).nullable().optional(),
  tools: z.array(z.string().trim().min(1).max(255)).optional(),
  medias: z.array(mediaSchema).optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
  q: optionalString(255),
  sort_order: z.enum(["asc", "desc"]).default("desc"),
  sort_by: z
    .enum(["created_at", "updated_at", "year", "month", "title"])
    .default("created_at"),
  project_type: z.nativeEnum(ProjectType).optional(),
  industry: optionalString(),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

export class PortfolioValidation {
  static readonly PAYLOAD = payloadSchema;
  static readonly LIST_QUERY = listQuerySchema;
}

export type PortfolioPayloadInput = z.infer<typeof PortfolioValidation.PAYLOAD>;
export type PortfolioListQuery = z.infer<typeof PortfolioValidation.LIST_QUERY>;
export type PortfolioMediaPayloadInput = z.infer<typeof mediaSchema>;
