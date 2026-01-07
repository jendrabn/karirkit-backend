import { z } from "zod";
import { Gender, Platform } from "../../generated/prisma/client";
import env from "../../config/env.config";

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

const maxDocumentStorageLimitBytes = env.documentStorageLimitMaxBytes;
const defaultDocumentStorageLimitBytes = 100 * 1024 * 1024;

export class UserValidation {
  static readonly LIST_QUERY = z.object({
    page: z.coerce.number().min(1).default(1),
    per_page: z.coerce.number().min(1).max(100).default(20),
    q: z.string().or(z.literal("")).optional(),
    sort_by: z
      .enum(["created_at", "updated_at", "name", "username", "email", "role"])
      .default("created_at"),
    sort_order: z.enum(["asc", "desc"]).default("desc"),
    role: z.enum(["user", "admin"]).optional(),
    created_from: z.string().or(z.literal("")).optional(),
    created_to: z.string().or(z.literal("")).optional(),
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
    daily_download_limit: z.coerce
      .number()
      .min(0)
      .max(1000)
      .default(10)
      .optional(),
    document_storage_limit: z.coerce
      .number()
      .min(0)
      .max(maxDocumentStorageLimitBytes)
      .default(defaultDocumentStorageLimitBytes)
      .optional(),
    social_links: z.array(socialLinkSchema).optional(),
  });

  static readonly UPDATE = z.object({
    name: optionalTrimmedString(3, 100),
    username: optionalTrimmedString(3, 100),
    email: z
      .string()
      .email("Format email tidak valid")
      .min(5, "Email minimal 5 karakter")
      .max(100, "Email maksimal 100 karakter")
      .or(z.literal(""))
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
    daily_download_limit: z.coerce.number().min(0).max(1000).optional(),
    document_storage_limit: z.coerce
      .number()
      .min(0)
      .max(maxDocumentStorageLimitBytes)
      .optional(),
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

  static readonly DAILY_DOWNLOAD_LIMIT_UPDATE = z.object({
    daily_download_limit: z.coerce.number().min(0).max(1000),
  });

  static readonly STORAGE_LIMIT_UPDATE = z.object({
    document_storage_limit: z.coerce
      .number()
      .min(0)
      .max(maxDocumentStorageLimitBytes),
  });

  static readonly MASS_DELETE = z.object({
    ids: z.array(z.string()).min(1, "Minimal satu ID harus dipilih"),
  });
}
