import { z } from "zod";

export class AuthValidation {
  static readonly REGISTER = z.object({
    name: z.string().min(3).max(100),
    username: z.string().min(3).max(100),
    email: z.email().min(5).max(100),
    password: z.string().min(6).max(100),
    phone: z
      .string()
      .regex(/^(?:\+62|62|0)\d{8,13}$/, "Phone must start with 08, 62, or +62")
      .or(z.literal(""))
      .nullable()
      .optional(),
  });

  static readonly LOGIN = z.object({
    identifier: z.string(),
    password: z.string(),
  });

  static readonly GOOGLE_LOGIN = z.object({
    id_token: z.string(),
  });

  static readonly UPDATE_ME = z
    .object({
      name: z.string().min(3).max(100).optional(),
      username: z.string().min(3).max(100).optional(),
      email: z.email().min(5).max(100).optional(),
      phone: z
        .string()
        .regex(
          /^(?:\+62|62|0)\d{8,13}$/,
          "Phone must start with 08, 62, or +62"
        )
        .or(z.literal(""))
        .nullable()
        .optional(),
      avatar: z.string().min(1).max(255).nullable().optional(),
    })
    .refine(
      (data) => Object.values(data).some((value) => value !== undefined),
      {
        message: "At least one field must be provided",
        path: ["root"],
      }
    );

  static readonly FORGOT_PASSWORD = z.object({
    email: z.email().min(5).max(100),
  });

  static readonly RESET_PASSWORD = z.object({
    token: z.string().min(10),
    password: z.string().min(6).max(100),
  });

  static readonly CHANGE_PASSWORD = z.object({
    current_password: z.string().min(6).max(100),
    new_password: z.string().min(6).max(100),
  });
}
