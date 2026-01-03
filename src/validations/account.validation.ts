import z from "zod";
import { Gender, Platform } from "../generated/prisma/client";

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

const genderSchema = z
  .nativeEnum(Gender)
  .or(z.literal(""))
  .nullable()
  .optional();

const socialLinkSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  platform: z.nativeEnum(Platform),
  url: trimmedString(500).url("Format URL tidak valid"),
});

export class AccountValidation {
  static readonly UPDATE_ME = z
    .object({
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
      social_links: z.array(socialLinkSchema).optional(),
      avatar: nullableTrimmedString(255),
    })
    .refine(
      (data) => Object.values(data).some((value) => value !== undefined),
      {
        message: "Minimal satu field harus diisi",
        path: ["root"],
      }
    );

  static readonly CHANGE_PASSWORD = z.object({
    current_password: z
      .string()
      .min(6, "Password saat ini minimal 6 karakter")
      .max(100, "Password saat ini maksimal 100 karakter"),
    new_password: z
      .string()
      .min(6, "Password baru minimal 6 karakter")
      .max(100, "Password baru maksimal 100 karakter"),
  });
}
