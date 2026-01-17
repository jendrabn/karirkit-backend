import { z } from "zod";
import {
  Degree,
  JobType,
  SkillLevel,
  SkillCategory,
  CvVisibility,
  OrganizationType,
  Language,
  Platform,
} from "../generated/prisma/client";
import {
  commaSeparatedNativeEnum,
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
  skill_category: z.nativeEnum(SkillCategory).default("other"),
});

const awardSchema = z.object({
  title: trimmedString(),
  issuer: trimmedString(),
  description: nullableTrimmedString(2000),
  year: yearSchema,
});

const socialLinkSchema = z.object({
  platform: z.nativeEnum(Platform),
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

const projectSchema = z.object({
  name: trimmedString(),
  description: nullableTrimmedString(2000),
  year: yearSchema,
  repo_url: nullableTrimmedString(2000),
  live_url: nullableTrimmedString(2000),
});

const slugSchema = z.string().trim().min(1, "Slug wajib diisi").max(255);

const payloadSchema = z.object({
  name: trimmedString(),
  headline: trimmedString(),
  email: z.string().trim().email("Format email tidak valid"),
  phone: trimmedString(),
  address: trimmedString(),
  about: trimmedString(5000),
  photo: nullableTrimmedString(),
  slug: slugSchema.optional(),
  visibility: z.nativeEnum(CvVisibility).optional(),
  template_id: z.string().uuid("ID template tidak valid"),
  language: z.nativeEnum(Language).default("id"),
  educations: z.array(educationSchema).optional(),
  certificates: z.array(certificateSchema).optional(),
  experiences: z.array(experienceSchema).optional(),
  skills: z.array(skillSchema).optional(),
  awards: z.array(awardSchema).optional(),
  social_links: z.array(socialLinkSchema).optional(),
  organizations: z.array(organizationSchema).optional(),
  projects: z.array(projectSchema).optional(),
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
    q: trimmedString(255).optional(),
    sort_order: z.enum(["asc", "desc"]).default("desc"),
    sort_by: z
      .enum(["created_at", "updated_at", "name", "views", "headline"])
      .default("created_at"),
    visibility: commaSeparatedNativeEnum(CvVisibility).optional(),
    language: commaSeparatedNativeEnum(Language).optional(),
    template_id: z.string().uuid("ID template tidak valid").optional(),
    created_at_from: optionalDateSchema(dateOnlySchema),
    created_at_to: optionalDateSchema(dateOnlySchema),
    updated_at_from: optionalDateSchema(dateOnlySchema),
    updated_at_to: optionalDateSchema(dateOnlySchema),
    views_from: optionalNumberSchema(z.number().int().nonnegative()),
    views_to: optionalNumberSchema(z.number().int().nonnegative()),
    educations_degree: commaSeparatedNativeEnum(Degree).optional(),
    experiences_job_type: commaSeparatedNativeEnum(JobType).optional(),
    experiences_is_current: optionalBooleanSchema,
    skills_level: commaSeparatedNativeEnum(SkillLevel).optional(),
    skills_skill_category: commaSeparatedNativeEnum(SkillCategory).optional(),
    organizations_organization_type:
      commaSeparatedNativeEnum(OrganizationType).optional(),
    name: optionalTrimmedString(),
    email: z.string().trim().email("Format email tidak valid").optional(),
    headline: optionalTrimmedString(),
    phone: optionalTrimmedString(),
    address: optionalTrimmedString(500),
    about: optionalTrimmedString(5000),
    slug: optionalTrimmedString(),
  })
  .superRefine((data, ctx) => {
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

    if (
      data.updated_at_from &&
      data.updated_at_to &&
      Date.parse(data.updated_at_from) > Date.parse(data.updated_at_to)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["updated_at_from"],
        message: "Tanggal mulai tidak boleh setelah tanggal selesai",
      });
    }

    if (
      data.views_from !== undefined &&
      data.views_to !== undefined &&
      data.views_from > data.views_to
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["views_from"],
        message: "Minimal views tidak boleh lebih besar dari maksimal views",
      });
    }
  });

const massDeleteSchema = z.object({
  ids: z.array(z.string()).min(1, "Minimal satu ID harus dipilih"),
});

const slugVisibilitySchema = z
  .object({
    slug: slugSchema.optional(),
    visibility: z.nativeEnum(CvVisibility).optional(),
  })
  .refine((value) => value.slug !== undefined || value.visibility !== undefined, {
    message: "Minimal salah satu field harus diisi",
  });

export class CvValidation {
  static readonly PAYLOAD = payloadSchema;
  static readonly LIST_QUERY = listQuerySchema;
  static readonly MASS_DELETE = massDeleteSchema;
  static readonly SLUG_VISIBILITY = slugVisibilitySchema;
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
export type CvProjectPayloadInput = z.infer<typeof projectSchema>;
export type MassDeleteInput = z.infer<typeof CvValidation.MASS_DELETE>;
export type CvSlugVisibilityInput = z.infer<typeof slugVisibilitySchema>;
