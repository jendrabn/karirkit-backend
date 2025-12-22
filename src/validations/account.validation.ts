import z from "zod";

export class AccountValidation {
  static readonly UPDATE_ME = z
    .object({
      name: z
        .string()
        .min(3, "Nama minimal 3 karakter")
        .max(100, "Nama maksimal 100 karakter")
        .or(z.literal(""))
        .optional(),
      username: z
        .string()
        .min(3, "Username minimal 3 karakter")
        .max(100, "Username maksimal 100 karakter")
        .or(z.literal(""))
        .optional(),
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
      avatar: z
        .string()
        .min(1, "Avatar minimal 1 karakter")
        .max(255, "Avatar maksimal 255 karakter")
        .or(z.literal(""))
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
