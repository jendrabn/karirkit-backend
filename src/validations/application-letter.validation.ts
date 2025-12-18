import { z } from "zod";
import { Gender, Language, MaritalStatus } from "../generated/prisma/client";

const stringField = (max = 255) =>
  z
    .string()
    .trim()
    .min(1, "Field ini wajib diisi")
    .max(max, `Maksimal ${max} karakter`);

const optionalNullableString = (max = 255) =>
  stringField(max).nullable().optional();

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
  signature: z.union([stringField(255), z.null()]).optional(),
  template_id: z.string().uuid("ID template tidak valid"),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1, "Halaman minimal 1").default(1),
  per_page: z.coerce
    .number()
    .int()
    .min(1, "Per halaman minimal 1")
    .max(100, "Per halaman maksimal 100")
    .default(20),
  q: stringField(255).optional(),
  sort_order: z.enum(["asc", "desc"]).default("desc"),
  sort_by: z
    .enum([
      "created_at",
      "updated_at",
      "application_date",
      "company_name",
      "subject",
    ])
    .default("created_at"),
  company_name: stringField(255).optional(),
  application_date: stringField(50).optional(),
});

export class ApplicationLetterValidation {
  static readonly PAYLOAD = payloadSchema;
  static readonly LIST_QUERY = listQuerySchema;
}

export type ApplicationLetterPayloadInput = z.infer<
  typeof ApplicationLetterValidation.PAYLOAD
>;

export type ApplicationLetterListQuery = z.infer<
  typeof ApplicationLetterValidation.LIST_QUERY
>;
