import { z } from "zod";
import {
  ApplicationResultStatus,
  ApplicationStatus,
  JobType,
  WorkSystem,
} from "../generated/prisma/client";
import {
  commaSeparatedNativeEnum,
  commaSeparatedStringSchema,
  optionalBooleanSchema,
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
  z.string().trim().max(max).or(z.literal("")).nullable().optional();

const optionalString = (max = 255) => z.string().trim().min(1).max(max);

const payloadSchema = z
  .object({
    company_name: z
      .string()
      .trim()
      .min(1, "Nama perusahaan wajib diisi")
      .max(255, "Maksimal 255 karakter"),
    company_url: nullableString(2000),
    position: z
      .string()
      .trim()
      .min(1, "Posisi wajib diisi")
      .max(255, "Maksimal 255 karakter"),
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
    contact_email: z
      .string()
      .trim()
      .email()
      .or(z.literal(""))
      .nullable()
      .optional(),
    contact_phone: nullableString(),
    follow_up_date: dateOnlySchema.nullable().optional(),
    follow_up_note: z
      .string()
      .trim()
      .max(2000, "Maksimal 2000 karakter")
      .nullable()
      .optional(),
    job_url: nullableString(2000),
    notes: z
      .string()
      .trim()
      .max(5000, "Maksimal 5000 karakter")
      .nullable()
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.salary_min !== undefined &&
      data.salary_max !== undefined &&
      data.salary_min > data.salary_max
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Gaji maksimal harus ≥ gaji minimal",
        path: ["salary_max"],
      });
    }
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
    q: optionalString(255).or(z.literal("")).optional(),
    sort_order: z.enum(["asc", "desc"]).default("desc"),
    sort_by: z
      .enum([
        "date",
        "created_at",
        "updated_at",
        "company_name",
        "position",
        "follow_up_date",
        "salary_max",
      ])
      .default("date"),
    status: commaSeparatedNativeEnum(ApplicationStatus).optional(),
    result_status: commaSeparatedNativeEnum(ApplicationResultStatus).optional(),
    job_type: commaSeparatedNativeEnum(JobType).optional(),
    work_system: commaSeparatedNativeEnum(WorkSystem).optional(),
    date_from: optionalDateSchema(dateOnlySchema),
    date_to: optionalDateSchema(dateOnlySchema),
    follow_up_date_from: optionalDateSchema(dateOnlySchema),
    follow_up_date_to: optionalDateSchema(dateOnlySchema),
    follow_up_date_has: optionalBooleanSchema,
    follow_up_overdue: optionalBooleanSchema,
    location: commaSeparatedStringSchema.optional(),
    company_name: optionalString().or(z.literal("")).optional(),
    job_source: commaSeparatedStringSchema.optional(),
    salary_from: optionalNumberSchema(z.number().int().nonnegative()),
    salary_to: optionalNumberSchema(z.number().int().nonnegative()),
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
        message: "Tanggal mulai tidak boleh setelah tanggal selesai",
      });
    }

    if (
      data.follow_up_date_from &&
      data.follow_up_date_to &&
      Date.parse(data.follow_up_date_from) >
        Date.parse(data.follow_up_date_to)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["follow_up_date_from"],
        message: "Tanggal follow up mulai tidak boleh setelah tanggal selesai",
      });
    }

    if (
      data.salary_from !== undefined &&
      data.salary_to !== undefined &&
      data.salary_from > data.salary_to
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["salary_from"],
        message: "Gaji minimal tidak boleh lebih besar dari gaji maksimal",
      });
    }
  });

const massDeleteSchema = z.object({
  ids: z.array(z.string()).min(1, "Minimal satu ID harus dipilih"),
});

export class ApplicationValidation {
  static readonly PAYLOAD = payloadSchema;
  static readonly LIST_QUERY = listQuerySchema;
  static readonly MASS_DELETE = massDeleteSchema;
}

export type ApplicationPayloadInput = z.infer<
  typeof ApplicationValidation.PAYLOAD
>;

export type ApplicationListQuery = z.infer<
  typeof ApplicationValidation.LIST_QUERY
>;

export type MassDeleteInput = z.infer<typeof ApplicationValidation.MASS_DELETE>;
