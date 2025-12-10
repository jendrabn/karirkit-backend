import { z } from "zod";
import { ProjectType } from "../generated/prisma/client";

const nullableString = (max = 255) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .nullable()
    .optional();

const optionalString = (max = 255) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .optional();

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/i,
    "Slug may only contain letters, numbers, and hyphens"
  );

const monthSchema = z.number().int().min(1).max(12);
const yearSchema = z.number().int().min(1900).max(2100);

const mediaSchema = z.object({
  path: z.string().trim().min(1).max(255),
  caption: z
    .string()
    .trim()
    .max(255)
    .nullable()
    .optional(),
});

const payloadSchema = z.object({
  title: z.string().trim().min(1).max(255),
  slug: slugSchema,
  sort_description: z.string().trim().min(1).max(255),
  description: z.string().trim().min(1).max(10000),
  role_title: z.string().trim().min(1).max(255),
  project_type: z.nativeEnum(ProjectType),
  industry: z.string().trim().min(1).max(255),
  month: monthSchema,
  year: yearSchema,
  live_url: nullableString(2000),
  repo_url: nullableString(2000),
  cover: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .nullable()
    .optional(),
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
