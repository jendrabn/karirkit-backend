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
    city_id: z.union([z.string(), z.array(z.string())]).optional(),
    province_id: z.union([z.string(), z.array(z.string())]).optional(),
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
    sort_by: z
      .enum(["created_at", "salary_min", "experience_min"])
      .default("created_at"),
    sort_order: z.enum(["asc", "desc"]).default("desc"),
  });

  static readonly SAVED_LIST_QUERY = z.object({
    page: z.coerce.number().min(1).default(1),
    per_page: z.coerce.number().min(1).max(50).default(10),
  });

  static readonly TOGGLE_SAVED_JOB = z.object({
    id: z.string().uuid("ID pekerjaan harus valid"),
  });

  static readonly MASS_DELETE_SAVED_JOBS = z.object({
    ids: z
      .array(z.string().uuid())
      .min(1, "Minimal satu pekerjaan harus dipilih"),
  });

  static readonly SLUG_PARAM = z.object({
    slug: z.string().min(1, "Slug harus diisi"),
  });
}
