import { z } from "zod";
import { DocumentType } from "../generated/prisma/client";
import {
  commaSeparatedNativeEnum,
  commaSeparatedStringSchema,
  optionalDateSchema,
  optionalNumberSchema,
} from "./query.util";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const dateOnlySchema = z
  .string()
  .trim()
  .regex(dateRegex, "Format tanggal: YYYY-MM-DD")
  .refine((value) => !Number.isNaN(Date.parse(value)), "Tanggal tidak valid");

const paginationSchema = z
  .object({
    page: z.coerce.number().int().min(1, "Halaman minimal 1").default(1),
    per_page: z
      .coerce.number()
      .int()
      .min(1, "Per halaman minimal 1")
      .max(200, "Per halaman maksimal 200")
      .default(20),
    type: commaSeparatedNativeEnum(DocumentType).optional(),
    mime_type: commaSeparatedStringSchema.optional(),
    size_from: optionalNumberSchema(z.number().int().nonnegative()),
    size_to: optionalNumberSchema(z.number().int().nonnegative()),
    created_at_from: optionalDateSchema(dateOnlySchema),
    created_at_to: optionalDateSchema(dateOnlySchema),
    q: z.string().trim().min(1).max(255).or(z.literal("")).optional(),
    sort_by: z
      .enum(["created_at", "updated_at", "original_name", "size", "type"])
      .default("created_at"),
    sort_order: z.enum(["asc", "desc"]).default("desc"),
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
      data.size_from !== undefined &&
      data.size_to !== undefined &&
      data.size_from > data.size_to
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["size_from"],
        message: "Ukuran minimal tidak boleh lebih besar dari ukuran maksimal",
      });
    }
  });

const uploadSchema = z.object({
  type: z.nativeEnum(DocumentType),
  name: z
    .string()
    .trim()
    .min(1, "Nama minimal 1 karakter")
    .max(255, "Nama maksimal 255 karakter")
    .optional(),
});

const massDeleteSchema = z.object({
  ids: z.array(z.string()).min(1, "Minimal satu dokumen harus dipilih"),
});

export class DocumentValidation {
  static readonly LIST_QUERY = paginationSchema;
  static readonly UPLOAD = uploadSchema;
  static readonly MASS_DELETE = massDeleteSchema;
}

export type DocumentListQuery = z.infer<typeof DocumentValidation.LIST_QUERY>;
export type DocumentUploadPayload = z.infer<
  typeof DocumentValidation.UPLOAD
>;
export type MassDeleteInput = z.infer<typeof DocumentValidation.MASS_DELETE>;
