import { z } from "zod";
import {
  optionalDateSchema,
  optionalNumberSchema,
} from "../query.util";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const dateOnlySchema = z
  .string()
  .trim()
  .regex(dateRegex, "Format tanggal: YYYY-MM-DD")
  .refine((value) => !Number.isNaN(Date.parse(value)), "Tanggal tidak valid");

export class JobRoleValidation {
  static readonly LIST_QUERY = z
    .object({
      page: z.coerce.number().min(1).default(1),
      per_page: z.coerce.number().min(1).max(100).default(20),
      q: z.string().optional(),
      sort_by: z
        .enum(["created_at", "updated_at", "name", "job_count"])
        .default("created_at"),
      sort_order: z.enum(["asc", "desc"]).default("desc"),
      job_count_from: optionalNumberSchema(z.number().int().nonnegative()),
      job_count_to: optionalNumberSchema(z.number().int().nonnegative()),
      created_at_from: optionalDateSchema(dateOnlySchema),
      created_at_to: optionalDateSchema(dateOnlySchema),
    })
    .superRefine((data, ctx) => {
      if (
        data.job_count_from !== undefined &&
        data.job_count_to !== undefined &&
        data.job_count_from > data.job_count_to
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["job_count_from"],
          message: "Jumlah job minimal tidak boleh lebih besar dari maksimal",
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

  static readonly CREATE = z.object({
    name: z
      .string()
      .min(3, "Nama minimal 3 karakter")
      .max(255, "Nama maksimal 255 karakter"),
  });

  static readonly UPDATE = z.object({
    name: z
      .string()
      .min(3, "Nama minimal 3 karakter")
      .max(255, "Nama maksimal 255 karakter")
      .optional(),
  });

  static readonly MASS_DELETE = z.object({
    ids: z.array(z.string()).min(1, "Minimal satu ID harus dipilih"),
  });

  static readonly ID_PARAM = z.object({
    id: z.string().uuid("ID harus berupa UUID yang valid"),
  });
}
