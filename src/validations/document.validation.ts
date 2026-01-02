import { z } from "zod";
import { DocumentType } from "../generated/prisma/client";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1, "Halaman minimal 1").default(1),
  per_page: z
    .coerce.number()
    .int()
    .min(1, "Per halaman minimal 1")
    .max(200, "Per halaman maksimal 200")
    .default(20),
  type: z.nativeEnum(DocumentType).optional(),
  q: z.string().trim().min(1).max(255).optional(),
  sort_by: z
    .enum(["uploaded_at", "original_name", "size", "type"])
    .default("uploaded_at"),
  sort_order: z.enum(["asc", "desc"]).default("desc"),
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
