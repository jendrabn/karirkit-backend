import { z } from "zod";
import {
  ApplicationResultStatus,
  ApplicationStatus,
  JobType,
  WorkSystem,
} from "../generated/prisma/client";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const dateOnlySchema = z
  .string()
  .trim()
  .regex(dateRegex, "Date must use YYYY-MM-DD format")
  .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date value");

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
    .max(max);

const payloadSchema = z
  .object({
    company_name: z.string().trim().min(1).max(255),
    company_url: nullableString(2000),
    position: z.string().trim().min(1).max(255),
    job_source: nullableString(),
    job_type: z.nativeEnum(JobType),
    work_system: z.nativeEnum(WorkSystem),
    salary_min: z.number().int().nonnegative().optional(),
    salary_max: z.number().int().nonnegative().optional(),
    location: nullableString(),
    date: dateOnlySchema,
    status: z.nativeEnum(ApplicationStatus),
    result_status: z.nativeEnum(ApplicationResultStatus),
    contact_name: nullableString(),
    contact_email: z.string().trim().email().nullable().optional(),
    contact_phone: nullableString(),
    follow_up_date: dateOnlySchema.nullable().optional(),
    follow_up_note: z.string().trim().max(2000).nullable().optional(),
    job_url: nullableString(2000),
    notes: z.string().trim().max(5000).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.salary_min !== undefined &&
      data.salary_max !== undefined &&
      data.salary_min > data.salary_max
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "salary_max must be greater than or equal to salary_min",
        path: ["salary_max"],
      });
    }
  });

const listQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    per_page: z.coerce.number().int().min(1).max(100).default(20),
    q: optionalString(255).optional(),
    sort_order: z.enum(["asc", "desc"]).default("desc"),
    sort_by: z
      .enum([
        "date",
        "created_at",
        "updated_at",
        "company_name",
        "position",
        "status",
        "result_status",
      ])
      .default("date"),
    status: z.nativeEnum(ApplicationStatus).optional(),
    result_status: z.nativeEnum(ApplicationResultStatus).optional(),
    job_type: z.nativeEnum(JobType).optional(),
    work_system: z.nativeEnum(WorkSystem).optional(),
    date_from: dateOnlySchema.optional(),
    date_to: dateOnlySchema.optional(),
    location: optionalString().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.date_from &&
      data.date_to &&
      Date.parse(data.date_from) > Date.parse(data.date_to)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["date_from"],
        message: "date_from cannot be after date_to",
      });
    }
  });

export class ApplicationValidation {
  static readonly PAYLOAD = payloadSchema;
  static readonly LIST_QUERY = listQuerySchema;
}

export type ApplicationPayloadInput = z.infer<
  typeof ApplicationValidation.PAYLOAD
>;

export type ApplicationListQuery = z.infer<
  typeof ApplicationValidation.LIST_QUERY
>;
