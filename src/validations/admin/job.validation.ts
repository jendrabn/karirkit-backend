import { z } from "zod";

export class JobValidation {
  static readonly LIST_QUERY = z.object({
    page: z.coerce.number().min(1).default(1),
    per_page: z.coerce.number().min(1).max(100).default(20),
    q: z.string().optional(),
    company_id: z
      .union([z.string().uuid(), z.array(z.string().uuid())])
      .optional(),
    job_role_id: z
      .union([z.string().uuid(), z.array(z.string().uuid())])
      .optional(),
    city_id: z
      .union([z.string().uuid(), z.array(z.string().uuid())])
      .optional(),
    province_id: z
      .union([z.string().uuid(), z.array(z.string().uuid())])
      .optional(),
    job_type: z
      .union([
        z.enum([
          "full_time",
          "part_time",
          "contract",
          "internship",
          "freelance",
        ]),
        z.array(
          z.enum([
            "full_time",
            "part_time",
            "contract",
            "internship",
            "freelance",
          ])
        ),
      ])
      .optional(),
    work_system: z
      .union([
        z.enum(["onsite", "hybrid", "remote"]),
        z.array(z.enum(["onsite", "hybrid", "remote"])),
      ])
      .optional(),
    education_level: z
      .union([
        z.enum([
          "middle_school",
          "high_school",
          "associate_d1",
          "associate_d2",
          "associate_d3",
          "bachelor",
          "master",
          "doctorate",
          "any",
        ]),
        z.array(
          z.enum([
            "middle_school",
            "high_school",
            "associate_d1",
            "associate_d2",
            "associate_d3",
            "bachelor",
            "master",
            "doctorate",
            "any",
          ])
        ),
      ])
      .optional(),
    experience_min: z.coerce.number().min(0).max(50).optional(),
    salary_min: z.coerce.number().min(1).optional(),
    status: z
      .union([
        z.enum(["draft", "published", "closed", "archived"]),
        z.array(z.enum(["draft", "published", "closed", "archived"])),
      ])
      .optional(),
    sort_by: z
      .enum(["created_at", "salary_min", "experience_min"])
      .default("created_at"),
    sort_order: z.enum(["asc", "desc"]).default("desc"),
  });

  static readonly CREATE = z
    .object({
      company_id: z.string().uuid("ID perusahaan harus valid"),
      job_role_id: z.string().uuid("ID job role harus valid"),
      city_id: z.string().uuid("ID kota harus valid").nullable().optional(),
      title: z
        .string()
        .min(3, "Judul minimal 3 karakter")
        .max(255, "Judul maksimal 255 karakter"),
      slug: z
        .string()
        .min(3, "Slug minimal 3 karakter")
        .max(255, "Slug maksimal 255 karakter"),
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
      poster: z.string().nullable().optional(),
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
      city_id: z.string().uuid("ID kota harus valid").nullable().optional(),
      title: z
        .string()
        .min(3, "Judul minimal 3 karakter")
        .max(255, "Judul maksimal 255 karakter")
        .optional(),
      slug: z
        .string()
        .min(3, "Slug minimal 3 karakter")
        .max(255, "Slug maksimal 255 karakter")
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
      poster: z.string().nullable().optional(),
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
