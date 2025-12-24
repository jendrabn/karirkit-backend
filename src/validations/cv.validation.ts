import { z } from "zod";
import {
  Degree,
  JobType,
  SkillLevel,
  OrganizationType,
  Language,
} from "../generated/prisma/client";

const trimmedString = (max = 255) =>
  z
    .string()
    .trim()
    .min(1, "Field ini wajib diisi")
    .max(max, `Maksimal ${max} karakter`);

const optionalTrimmedString = (max = 255) =>
  z
    .string()
    .trim()
    .max(max, `Maksimal ${max} karakter`)
    .or(z.literal(""))
    .optional();

const nullableTrimmedString = (max = 255) =>
  z
    .string()
    .trim()
    .max(max, `Maksimal ${max} karakter`)
    .or(z.literal(""))
    .nullable()
    .optional();

const yearSchema = z
  .number()
  .int()
  .min(1900, "Tahun minimal 1900")
  .max(2100, "Tahun maksimal 2100");
const monthSchema = z
  .number()
  .int()
  .min(1, "Bulan minimal 1")
  .max(12, "Bulan maksimal 12");

const educationSchema = z.object({
  degree: z.nativeEnum(Degree),
  school_name: trimmedString(),
  school_location: trimmedString(),
  major: trimmedString(),
  start_month: monthSchema,
  start_year: yearSchema,
  end_month: monthSchema.nullable().optional(),
  end_year: yearSchema.nullable().optional(),
  is_current: z.boolean(),
  gpa: z.number().min(0).max(10).nullable().optional(),
  description: nullableTrimmedString(2000),
});

const certificateSchema = z.object({
  title: trimmedString(),
  issuer: trimmedString(),
  issue_month: monthSchema,
  issue_year: yearSchema,
  expiry_month: monthSchema.nullable().optional(),
  expiry_year: yearSchema.nullable().optional(),
  no_expiry: z.boolean().optional(),
  credential_id: nullableTrimmedString(),
  credential_url: nullableTrimmedString(2000),
  description: nullableTrimmedString(2000),
});

const experienceSchema = z.object({
  job_title: trimmedString(),
  company_name: trimmedString(),
  company_location: trimmedString(),
  job_type: z.nativeEnum(JobType),
  start_month: monthSchema,
  start_year: yearSchema,
  end_month: monthSchema.nullable().optional(),
  end_year: yearSchema.nullable().optional(),
  is_current: z.boolean(),
  description: nullableTrimmedString(2000),
});

const skillSchema = z.object({
  name: trimmedString(),
  level: z.nativeEnum(SkillLevel),
});

const awardSchema = z.object({
  title: trimmedString(),
  issuer: trimmedString(),
  description: nullableTrimmedString(2000),
  year: yearSchema,
});

const socialLinkSchema = z.object({
  platform: trimmedString(),
  url: trimmedString(2000),
});

const organizationSchema = z.object({
  organization_name: trimmedString(),
  role_title: trimmedString(),
  organization_type: z.nativeEnum(OrganizationType),
  location: trimmedString(),
  start_month: monthSchema,
  start_year: yearSchema,
  end_month: monthSchema.nullable().optional(),
  end_year: yearSchema.nullable().optional(),
  is_current: z.boolean(),
  description: nullableTrimmedString(2000),
});

const payloadSchema = z.object({
  name: trimmedString(),
  headline: trimmedString(),
  email: z.string().trim().email("Format email tidak valid"),
  phone: trimmedString(),
  address: trimmedString(),
  about: trimmedString(5000),
  photo: nullableTrimmedString(),
  template_id: z.string().uuid("ID template tidak valid"),
  language: z.nativeEnum(Language).default("id"),
  educations: z.array(educationSchema).optional(),
  certificates: z.array(certificateSchema).optional(),
  experiences: z.array(experienceSchema).optional(),
  skills: z.array(skillSchema).optional(),
  awards: z.array(awardSchema).optional(),
  social_links: z.array(socialLinkSchema).optional(),
  organizations: z.array(organizationSchema).optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1, "Halaman minimal 1").default(1),
  per_page: z.coerce
    .number()
    .int()
    .min(1, "Per halaman minimal 1")
    .max(100, "Per halaman maksimal 100")
    .default(20),
  q: trimmedString(255).optional(),
  sort_order: z.enum(["asc", "desc"]).default("desc"),
  sort_by: z.enum(["created_at", "updated_at", "name"]).default("created_at"),
  name: optionalTrimmedString(),
  email: z.string().trim().email("Format email tidak valid").optional(),
});

const massDeleteSchema = z.object({
  ids: z.array(z.string()).min(1, "Minimal satu ID harus dipilih"),
});

export class CvValidation {
  static readonly PAYLOAD = payloadSchema;
  static readonly LIST_QUERY = listQuerySchema;
  static readonly MASS_DELETE = massDeleteSchema;
}

export type CvPayloadInput = z.infer<typeof payloadSchema>;
export type CvListQueryInput = z.infer<typeof listQuerySchema>;
export type CvEducationPayloadInput = z.infer<typeof educationSchema>;
export type CvCertificatePayloadInput = z.infer<typeof certificateSchema>;
export type CvExperiencePayloadInput = z.infer<typeof experienceSchema>;
export type CvSkillPayloadInput = z.infer<typeof skillSchema>;
export type CvAwardPayloadInput = z.infer<typeof awardSchema>;
export type CvSocialLinkPayloadInput = z.infer<typeof socialLinkSchema>;
export type CvOrganizationPayloadInput = z.infer<typeof organizationSchema>;
export type MassDeleteInput = z.infer<typeof CvValidation.MASS_DELETE>;
