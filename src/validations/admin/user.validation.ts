import { z } from "zod";
import {
  Gender,
  Platform,
  UserRole,
  UserStatus,
} from "../../generated/prisma/client";
import {
  commaSeparatedNativeEnum,
  optionalBooleanSchema,
  optionalDateSchema,
  optionalNumberSchema,
} from "../query.util";

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

const optionalTrimmedString = (min = 1, max = 255) =>
  z
    .string()
    .trim()
    .min(min, `Minimal ${min} karakter`)
    .max(max, `Maksimal ${max} karakter`)
    .optional();

const nullableTrimmedString = (max = 255) =>
  z
    .string()
    .trim()
    .max(max, `Maksimal ${max} karakter`)
    .or(z.literal(""))
    .nullable()
    .optional();

const nullableDateString = () =>
  z
    .string()
    .trim()
    .refine(
      (value) => value === "" || !Number.isNaN(Date.parse(value)),
      "Format tanggal tidak valid"
    )
    .or(z.literal(""))
    .nullable()
    .optional();

const genderSchema = z.nativeEnum(Gender).or(z.literal("")).nullable().optional();

const socialLinkSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  platform: z.nativeEnum(Platform),
  url: trimmedString(500).url("Format URL tidak valid"),
});

export class UserValidation {
  static readonly LIST_QUERY = z
    .object({
      page: z.coerce.number().min(1).default(1),
      per_page: z.coerce.number().min(1).max(100).default(20),
      q: z.string().or(z.literal("")).optional(),
      sort_by: z
        .enum([
          "created_at",
          "updated_at",
          "name",
          "email",
          "role",
          "status",
          "max_cvs",
          "max_application_letters",
          "max_applications",
          "max_document_storage_bytes",
          "max_cv_pdf_downloads",
          "max_cv_docx_downloads",
          "max_letter_pdf_downloads",
          "max_letter_docx_downloads",
          "max_cv_ai_improvements",
          "max_application_letter_ai_improvements",
        ])
        .default("created_at"),
      sort_order: z.enum(["asc", "desc"]).default("desc"),
      role: commaSeparatedNativeEnum(UserRole).optional(),
      status: commaSeparatedNativeEnum(UserStatus).optional(),
      gender: commaSeparatedNativeEnum(Gender).optional(),
      email_verified: optionalBooleanSchema,
      suspended: optionalBooleanSchema,
      created_at_from: optionalDateSchema(dateOnlySchema),
      created_at_to: optionalDateSchema(dateOnlySchema),
      max_cvs_from: optionalNumberSchema(z.number().int().nonnegative()),
      max_cvs_to: optionalNumberSchema(z.number().int().nonnegative()),
      max_application_letters_from: optionalNumberSchema(z.number().int().nonnegative()),
      max_application_letters_to: optionalNumberSchema(z.number().int().nonnegative()),
      max_applications_from: optionalNumberSchema(z.number().int().nonnegative()),
      max_applications_to: optionalNumberSchema(z.number().int().nonnegative()),
      max_document_storage_bytes_from: optionalNumberSchema(z.number().int().nonnegative()),
      max_document_storage_bytes_to: optionalNumberSchema(z.number().int().nonnegative()),
      max_cv_pdf_downloads_from: optionalNumberSchema(z.number().int().nonnegative()),
      max_cv_pdf_downloads_to: optionalNumberSchema(z.number().int().nonnegative()),
      max_cv_docx_downloads_from: optionalNumberSchema(z.number().int().nonnegative()),
      max_cv_docx_downloads_to: optionalNumberSchema(z.number().int().nonnegative()),
      max_letter_pdf_downloads_from: optionalNumberSchema(z.number().int().nonnegative()),
      max_letter_pdf_downloads_to: optionalNumberSchema(z.number().int().nonnegative()),
      max_letter_docx_downloads_from: optionalNumberSchema(z.number().int().nonnegative()),
      max_letter_docx_downloads_to: optionalNumberSchema(z.number().int().nonnegative()),
      max_cv_ai_improvements_from: optionalNumberSchema(z.number().int().nonnegative()),
      max_cv_ai_improvements_to: optionalNumberSchema(z.number().int().nonnegative()),
      max_application_letter_ai_improvements_from: optionalNumberSchema(z.number().int().nonnegative()),
      max_application_letter_ai_improvements_to: optionalNumberSchema(z.number().int().nonnegative()),
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
    });

  static readonly CREATE = z.object({
    name: trimmedString(100).min(3, "Nama minimal 3 karakter"),
    username: trimmedString(100).min(3, "Username minimal 3 karakter"),
    email: z
      .string()
      .email("Format email tidak valid")
      .min(5, "Email minimal 5 karakter")
      .max(100, "Email maksimal 100 karakter"),
    password: z
      .string()
      .min(6, "Password minimal 6 karakter")
      .max(100, "Password maksimal 100 karakter"),
    phone: z
      .string()
      .regex(/^(?:\+62|62|0)\d{8,13}$/, "Format: 08xxx, 62xxx, atau +62xxx")
      .or(z.literal(""))
      .nullable()
      .optional(),
    headline: nullableTrimmedString(255),
    bio: nullableTrimmedString(5000),
    location: nullableTrimmedString(255),
    gender: genderSchema,
    birth_date: nullableDateString(),
    role: z.enum(["user", "admin"]).default("user"),
    avatar: z.string().or(z.literal("")).nullable().optional(),
    social_links: z.array(socialLinkSchema).optional(),
  });

  static readonly UPDATE = z.object({
    name: optionalTrimmedString(3, 100),
    username: optionalTrimmedString(3, 100),
    email: z
      .string()
      .trim()
      .email("Format email tidak valid")
      .min(5, "Email minimal 5 karakter")
      .max(100, "Email maksimal 100 karakter")
      .optional(),
    password: z
      .string()
      .trim()
      .min(6, "Password minimal 6 karakter")
      .max(100, "Password maksimal 100 karakter")
      .or(z.literal(""))
      .nullable()
      .optional(),
    phone: z
      .string()
      .regex(/^(?:\+62|62|0)\d{8,13}$/, "Format: 08xxx, 62xxx, atau +62xxx")
      .or(z.literal(""))
      .nullable()
      .optional(),
    headline: nullableTrimmedString(255),
    bio: nullableTrimmedString(5000),
    location: nullableTrimmedString(255),
    gender: genderSchema,
    birth_date: nullableDateString(),
    role: z.enum(["user", "admin"]).optional(),
    avatar: z.string().or(z.literal("")).nullable().optional(),
    social_links: z.array(socialLinkSchema).optional(),
    status: z.enum(["active", "suspended", "banned"]).optional(),
    status_reason: z.string().max(500).or(z.literal("")).nullable().optional(),
    suspended_until: z
      .string()
      .or(z.literal(""))
      .nullable()
      .optional()
      .refine(
        (value) => {
          if (!value) {
            return true;
          }
          return !Number.isNaN(Date.parse(value));
        },
        { message: "Format tanggal penangguhan tidak valid" }
      ),
  });

  static readonly STATUS_UPDATE = z.object({
    status: z.enum(["active", "suspended", "banned"]),
    status_reason: z.string().max(500).or(z.literal("")).nullable().optional(),
    suspended_until: z
      .string()
      .or(z.literal(""))
      .nullable()
      .optional()
      .refine(
        (value) => {
          if (!value) {
            return true;
          }
          return !Number.isNaN(Date.parse(value));
        },
        { message: "Format tanggal penangguhan tidak valid" }
      ),
  });

  static readonly MASS_DELETE = z.object({
    ids: z.array(z.string()).min(1, "Minimal satu ID harus dipilih"),
  });
}
