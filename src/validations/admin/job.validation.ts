import { z } from "zod";
import {
  commaSeparatedEnumSchema,
  commaSeparatedStringSchema,
  optionalDateSchema,
  optionalNumberSchema,
} from "../query.util";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const dateOnlySchema = z
  .string()
  .trim()
  .regex(dateRegex, "Format tanggal: YYYY-MM-DD")
  .refine((value) => !Number.isNaN(Date.parse(value)), "Tanggal tidak valid");

const uuidListSchema = commaSeparatedStringSchema.refine(
  (values) => values.every((value) => z.string().uuid().safeParse(value).success),
  "ID harus berupa UUID yang valid"
);

const mediaSchema = z.object({
  path: z
    .string()
    .trim()
    .min(1, "Path media wajib diisi")
    .max(255, "Maksimal 255 karakter"),
});

export class JobValidation {
  static readonly LIST_QUERY = z
    .object({
      page: z.coerce.number().min(1).default(1),
      per_page: z.coerce.number().min(1).max(100).default(20),
      q: z.string().optional(),
      status: commaSeparatedEnumSchema([
        "draft",
        "published",
        "closed",
        "archived",
      ]).optional(),
      job_type: commaSeparatedEnumSchema([
        "full_time",
        "part_time",
        "contract",
        "internship",
        "freelance",
      ]).optional(),
      work_system: commaSeparatedEnumSchema([
        "onsite",
        "hybrid",
        "remote",
      ]).optional(),
      education_level: commaSeparatedEnumSchema([
        "middle_school",
        "high_school",
        "associate_d1",
        "associate_d2",
        "associate_d3",
        "bachelor",
        "master",
        "doctorate",
        "any",
      ]).optional(),
      company_id: uuidListSchema.optional(),
      job_role_id: uuidListSchema.optional(),
      city_id: uuidListSchema.optional(),
      salary_from: optionalNumberSchema(z.number().int().nonnegative()),
      salary_to: optionalNumberSchema(z.number().int().nonnegative()),
      years_of_experience_from: optionalNumberSchema(
        z.number().int().min(0).max(50)
      ),
      years_of_experience_to: optionalNumberSchema(
        z.number().int().min(0).max(50)
      ),
      expiration_date_from: optionalDateSchema(dateOnlySchema),
      expiration_date_to: optionalDateSchema(dateOnlySchema),
      created_at_from: optionalDateSchema(dateOnlySchema),
      created_at_to: optionalDateSchema(dateOnlySchema),
      sort_by: z
        .enum([
          "created_at",
          "updated_at",
          "title",
          "company_name",
          "status",
          "salary_max",
          "expiration_date",
        ])
        .default("created_at"),
      sort_order: z.enum(["asc", "desc"]).default("desc"),
    })
    .superRefine((data, ctx) => {
      if (
        data.salary_from !== undefined &&
        data.salary_to !== undefined &&
        data.salary_from > data.salary_to
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["salary_from"],
          message: "Gaji minimal tidak boleh lebih besar dari gaji maksimal",
        });
      }

      if (
        data.years_of_experience_from !== undefined &&
        data.years_of_experience_to !== undefined &&
        data.years_of_experience_from > data.years_of_experience_to
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["years_of_experience_from"],
          message:
            "Pengalaman minimal tidak boleh lebih besar dari pengalaman maksimal",
        });
      }

      if (
        data.expiration_date_from &&
        data.expiration_date_to &&
        Date.parse(data.expiration_date_from) >
          Date.parse(data.expiration_date_to)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["expiration_date_from"],
          message: "Tanggal mulai tidak boleh setelah tanggal selesai",
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

  static readonly CREATE = z
    .object({
      company_id: z.string().uuid("ID perusahaan harus valid"),
      job_role_id: z.string().uuid("ID job role harus valid"),
      city_id: z.string("ID kota harus valid").nullable().optional(),
      title: z
        .string()
        .min(3, "Judul minimal 3 karakter")
        .max(255, "Judul maksimal 255 karakter"),

      job_type: z.enum(
        ["full_time", "part_time", "contract", "internship", "freelance"],
        "Tipe pekerjaan tidak valid"
      ),
      work_system: z.enum(
        ["onsite", "hybrid", "remote"],
        "Sistem kerja tidak valid"
      ),
      education_level: z.enum(
        [
          "middle_school",
          "high_school",
          "associate_d1",
          "associate_d2",
          "associate_d3",
          "bachelor",
          "master",
          "doctorate",
          "any",
        ],
        "Tingkat pendidikan tidak valid"
      ),
      min_years_of_experience: z
        .number()
        .min(0, "Pengalaman minimal 0 tahun")
        .max(50, "Pengalaman maksimal 50 tahun"),
      max_years_of_experience: z
        .number()
        .min(0, "Pengalaman minimal 0 tahun")
        .max(50, "Pengalaman maksimal 50 tahun")
        .nullable()
        .optional(),
      description: z.string().min(10, "Deskripsi minimal 10 karakter"),
      requirements: z.string().min(10, "Persyaratan minimal 10 karakter"),
      salary_min: z
        .number()
        .min(1, "Gaji minimal harus lebih dari 0")
        .nullable()
        .optional(),
      salary_max: z
        .number()
        .min(1, "Gaji maksimal harus lebih dari 0")
        .nullable()
        .optional(),
      talent_quota: z
        .number()
        .min(1, "Kuota minimal 1")
        .max(1000, "Kuota maksimal 1000")
        .nullable()
        .optional(),
      job_url: z
        .union([
          z.literal("").transform(() => null),
          z.string().url("URL tidak valid").nullable(),
        ])
        .optional(),
      contact_name: z
        .string()
        .min(3, "Nama kontak minimal 3 karakter")
        .max(255, "Nama kontak maksimal 255 karakter")
        .nullable()
        .optional(),
      contact_email: z
        .string()
        .email("Email tidak valid")
        .nullable()
        .optional(),
      contact_phone: z
        .string()
        .regex(/^(?:\+62|62|0)\d{8,13}$/, "Format telepon tidak valid")
        .nullable()
        .optional(),
      medias: z.array(mediaSchema).optional(),
      status: z
        .enum(
          ["draft", "published", "closed", "archived"],
          "Status tidak valid"
        )
        .default("draft"),
      expiration_date: z
        .string()
        .datetime("Format tanggal tidak valid")
        .nullable()
        .optional(),
    })
    .refine(
      (data) => {
        if (
          data.salary_min &&
          data.salary_max &&
          data.salary_min > data.salary_max
        ) {
          return false;
        }
        return true;
      },
      {
        message: "Gaji minimal tidak boleh lebih besar dari gaji maksimal",
        path: ["salary_max"],
      }
    )
    .refine(
      (data) => {
        if (
          data.min_years_of_experience &&
          data.max_years_of_experience &&
          data.min_years_of_experience > data.max_years_of_experience
        ) {
          return false;
        }
        return true;
      },
      {
        message:
          "Pengalaman minimal tidak boleh lebih besar dari pengalaman maksimal",
        path: ["max_years_of_experience"],
      }
    );

  static readonly UPDATE = z
    .object({
      company_id: z.string().uuid("ID perusahaan harus valid").optional(),
      job_role_id: z.string().uuid("ID job role harus valid").optional(),
      city_id: z.string("ID kota harus valid").nullable().optional(),
      title: z
        .string()
        .min(3, "Judul minimal 3 karakter")
        .max(255, "Judul maksimal 255 karakter")
        .optional(),

      job_type: z
        .enum(
          ["full_time", "part_time", "contract", "internship", "freelance"],
          "Tipe pekerjaan tidak valid"
        )
        .optional(),
      work_system: z
        .enum(["onsite", "hybrid", "remote"], "Sistem kerja tidak valid")
        .optional(),
      education_level: z
        .enum(
          [
            "middle_school",
            "high_school",
            "associate_d1",
            "associate_d2",
            "associate_d3",
            "bachelor",
            "master",
            "doctorate",
            "any",
          ],
          "Tingkat pendidikan tidak valid"
        )
        .optional(),
      min_years_of_experience: z
        .number()
        .min(0, "Pengalaman minimal 0 tahun")
        .max(50, "Pengalaman maksimal 50 tahun")
        .optional(),
      max_years_of_experience: z
        .number()
        .min(0, "Pengalaman minimal 0 tahun")
        .max(50, "Pengalaman maksimal 50 tahun")
        .nullable()
        .optional(),
      description: z
        .string()
        .min(10, "Deskripsi minimal 10 karakter")
        .optional(),
      requirements: z
        .string()
        .min(10, "Persyaratan minimal 10 karakter")
        .optional(),
      salary_min: z
        .number()
        .min(1, "Gaji minimal harus lebih dari 0")
        .nullable()
        .optional(),
      salary_max: z
        .number()
        .min(1, "Gaji maksimal harus lebih dari 0")
        .nullable()
        .optional(),
      talent_quota: z
        .number()
        .min(1, "Kuota minimal 1")
        .max(1000, "Kuota maksimal 1000")
        .nullable()
        .optional(),
      job_url: z
        .union([
          z.literal("").transform(() => null),
          z.string().url("URL tidak valid").nullable(),
        ])
        .optional(),
      contact_name: z
        .string()
        .min(3, "Nama kontak minimal 3 karakter")
        .max(255, "Nama kontak maksimal 255 karakter")
        .nullable()
        .optional(),
      contact_email: z
        .string()
        .email("Email tidak valid")
        .nullable()
        .optional(),
      contact_phone: z
        .string()
        .regex(/^(?:\+62|62|0)\d{8,13}$/, "Format telepon tidak valid")
        .nullable()
        .optional(),
      medias: z.array(mediaSchema).optional(),
      status: z
        .enum(
          ["draft", "published", "closed", "archived"],
          "Status tidak valid"
        )
        .optional(),
      expiration_date: z
        .string()
        .datetime("Format tanggal tidak valid")
        .nullable()
        .optional(),
    })
    .refine(
      (data) => {
        if (
          data.salary_min &&
          data.salary_max &&
          data.salary_min > data.salary_max
        ) {
          return false;
        }
        return true;
      },
      {
        message: "Gaji minimal tidak boleh lebih besar dari gaji maksimal",
        path: ["salary_max"],
      }
    )
    .refine(
      (data) => {
        if (
          data.min_years_of_experience &&
          data.max_years_of_experience &&
          data.min_years_of_experience > data.max_years_of_experience
        ) {
          return false;
        }
        return true;
      },
      {
        message:
          "Pengalaman minimal tidak boleh lebih besar dari pengalaman maksimal",
        path: ["max_years_of_experience"],
      }
    );

  static readonly MASS_DELETE = z.object({
    ids: z.array(z.string()).min(1, "Minimal satu ID harus dipilih"),
  });

  static readonly ID_PARAM = z.object({
    id: z.string().uuid("ID harus berupa UUID yang valid"),
  });

  static readonly SLUG_PARAM = z.object({
    slug: z.string().min(1, "Slug harus diisi"),
  });
}
