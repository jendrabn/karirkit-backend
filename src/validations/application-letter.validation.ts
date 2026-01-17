import { z } from "zod";
import { Gender, Language, MaritalStatus } from "../generated/prisma/client";
import {
  commaSeparatedNativeEnum,
  commaSeparatedStringSchema,
  optionalDateSchema,
} from "./query.util";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const dateOnlySchema = z
  .string()
  .trim()
  .regex(dateRegex, "Format tanggal: YYYY-MM-DD")
  .refine((value) => !Number.isNaN(Date.parse(value)), "Tanggal tidak valid");

const stringField = (max = 255) =>
  z
    .string()
    .trim()
    .min(1, "Field ini wajib diisi")
    .max(max, `Maksimal ${max} karakter`);

const optionalNullableString = (max = 255) =>
  z
    .string()
    .trim()
    .max(max, `Maksimal ${max} karakter`)
    .or(z.literal(""))
    .nullable()
    .optional();

const payloadSchema = z.object({
  name: stringField(),
  birth_place_date: stringField(255),
  gender: z.nativeEnum(Gender),
  marital_status: z.nativeEnum(MaritalStatus),
  education: stringField(),
  phone: stringField(50),
  email: z
    .string()
    .trim()
    .email("Format email tidak valid")
    .max(255, "Email maksimal 255 karakter"),
  address: stringField(500),
  subject: stringField(255),
  applicant_city: stringField(255),
  application_date: stringField(50),
  receiver_title: stringField(255),
  company_name: stringField(255),
  company_city: optionalNullableString(255),
  company_address: optionalNullableString(500),
  opening_paragraph: stringField(2000),
  body_paragraph: stringField(5000),
  attachments: stringField(2000),
  closing_paragraph: stringField(2000),
  signature: optionalNullableString(255),
  template_id: z.string().uuid("ID template tidak valid"),
  language: z.nativeEnum(Language).default("id"),
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
    q: z.string().trim().max(255).or(z.literal("")).optional(),
    sort_order: z.enum(["asc", "desc"]).default("desc"),
    sort_by: z
      .enum([
        "created_at",
        "updated_at",
        "application_date",
        "company_name",
        "name",
      ])
      .default("created_at"),
    gender: commaSeparatedNativeEnum(Gender).optional(),
    marital_status: commaSeparatedNativeEnum(MaritalStatus).optional(),
    language: commaSeparatedNativeEnum(Language).optional(),
    company_name: z.string().trim().max(255).or(z.literal("")).optional(),
    company_city: commaSeparatedStringSchema.optional(),
    applicant_city: commaSeparatedStringSchema.optional(),
    template_id: z.string().uuid("ID template tidak valid").optional(),
    application_date_from: optionalDateSchema(dateOnlySchema),
    application_date_to: optionalDateSchema(dateOnlySchema),
    created_at_from: optionalDateSchema(dateOnlySchema),
    created_at_to: optionalDateSchema(dateOnlySchema),
  })
  .superRefine((data, ctx) => {
    if (
      data.application_date_from &&
      data.application_date_to &&
      Date.parse(data.application_date_from) >
        Date.parse(data.application_date_to)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["application_date_from"],
        message: "Tanggal mulai tidak boleh setelah tanggal selesai",
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

const massDeleteSchema = z.object({
  ids: z.array(z.string()).min(1, "Minimal satu ID harus dipilih"),
});

export class ApplicationLetterValidation {
  static readonly PAYLOAD = payloadSchema;
  static readonly LIST_QUERY = listQuerySchema;
  static readonly MASS_DELETE = massDeleteSchema;
}

export type ApplicationLetterPayloadInput = z.infer<
  typeof ApplicationLetterValidation.PAYLOAD
>;

export type ApplicationLetterListQuery = z.infer<
  typeof ApplicationLetterValidation.LIST_QUERY
>;

export type MassDeleteInput = z.infer<
  typeof ApplicationLetterValidation.MASS_DELETE
>;
