import { z } from "zod";

export class AuthValidation {
  static readonly REGISTER = z.object({
    name: z
      .string()
      .min(3, "Nama minimal 3 karakter")
      .max(100, "Nama maksimal 100 karakter"),
    username: z
      .string()
      .min(3, "Username minimal 3 karakter")
      .max(100, "Username maksimal 100 karakter"),
    email: z
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
  });

  static readonly LOGIN = z.object({
    identifier: z.string().min(1, "Username/email wajib diisi"),
    password: z.string().min(1, "Password wajib diisi"),
  });

  static readonly GOOGLE_LOGIN = z.object({
    id_token: z.string().min(1, "ID Token wajib diisi"),
  });

  static readonly UPDATE_ME = z
    .object({
      name: z
        .string()
        .min(3, "Nama minimal 3 karakter")
        .max(100, "Nama maksimal 100 karakter")
        .optional(),
      username: z
        .string()
        .min(3, "Username minimal 3 karakter")
        .max(100, "Username maksimal 100 karakter")
        .optional(),
      email: z
        .email("Format email tidak valid")
        .min(5, "Email minimal 5 karakter")
        .max(100, "Email maksimal 100 karakter")
        .optional(),
      phone: z
        .string()
        .regex(/^(?:\+62|62|0)\d{8,13}$/, "Format: 08xxx, 62xxx, atau +62xxx")
        .or(z.literal(""))
        .nullable()
        .optional(),
      avatar: z
        .string()
        .min(1, "Avatar minimal 1 karakter")
        .max(255, "Avatar maksimal 255 karakter")
        .nullable()
        .optional(),
    })
    .refine(
      (data) => Object.values(data).some((value) => value !== undefined),
      {
        message: "Minimal satu field harus diisi",
        path: ["root"],
      }
    );

  static readonly FORGOT_PASSWORD = z.object({
    email: z
      .email("Format email tidak valid")
      .min(5, "Email minimal 5 karakter")
      .max(100, "Email maksimal 100 karakter"),
  });

  static readonly RESET_PASSWORD = z.object({
    token: z.string().min(10, "Token minimal 10 karakter"),
    password: z
      .string()
      .min(6, "Password minimal 6 karakter")
      .max(100, "Password maksimal 100 karakter"),
  });

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

  static readonly SEND_OTP = z.object({
    identifier: z
      .string()
      .min(1, "Identifier wajib diisi")
      .max(100, "Identifier maksimal 100 karakter"),
  });

  static readonly VERIFY_OTP = z.object({
    identifier: z
      .string()
      .min(1, "Identifier wajib diisi")
      .max(100, "Identifier maksimal 100 karakter"),
    otp_code: z
      .string()
      .min(4, "Kode OTP minimal 4 digit")
      .max(10, "Kode OTP maksimal 10 digit"),
    password: z
      .string()
      .min(6, "Password minimal 6 karakter")
      .max(100, "Password maksimal 100 karakter"),
  });

  static readonly RESEND_OTP = z.object({
    identifier: z
      .string()
      .min(1, "Identifier wajib diisi")
      .max(100, "Identifier maksimal 100 karakter"),
  });
}
