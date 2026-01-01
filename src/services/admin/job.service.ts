import { PrismaClient } from "../../generated/prisma/client";
import {
  CreateJobRequest,
  UpdateJobRequest,
  JobListQueryParams,
  JobListResponse,
  JobResponse,
} from "../../types/job-portal-schemas";
import { validate } from "../../utils/validate.util";
import { z } from "zod";
import { ResponseError } from "../../utils/response-error.util";
import { UploadService } from "../upload.service";
import { prisma } from "../../config/prisma.config";
import { slugify } from "../../utils/slugify.util";
import { isHttpUrl } from "../../utils/url.util";

const sortFieldMap = {
  created_at: "createdAt",
  updated_at: "updatedAt",
  title: "title",
  salary_min: "salaryMin",
  experience_min: "minYearsOfExperience",
} as const;

type JobMediaPayload = {
  path: string;
};

export class AdminJobService {
  static async list(query: unknown): Promise<JobListResponse> {
    const requestData = validate(
      z.object({
        page: z.coerce.number().min(1).default(1),
        per_page: z.coerce.number().min(1).max(50).default(20),
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
        salary_min: z.coerce.number().min(0).optional(),
        sort_by: z
          .enum(["created_at", "salary_min", "experience_min"])
          .default("created_at"),
        sort_order: z.enum(["asc", "desc"]).default("desc"),
        status: z
          .union([
            z.enum(["draft", "published", "closed", "archived"]),
            z.array(z.enum(["draft", "published", "closed", "archived"])),
          ])
          .optional(),
      }),
      query
    );

    const page = requestData.page;
    const perPage = requestData.per_page;
    const skip = (page - 1) * perPage;
    const take = perPage;

    const where: any = {};

    // Search functionality with improved full-text search
    if (requestData.q) {
      const searchTerm = requestData.q.trim();

      // Create search conditions for better matching
      const searchConditions = [
        { title: { contains: searchTerm } },
        { description: { contains: searchTerm } },
        { company: { name: { contains: searchTerm } } },
      ];

      // Add the search conditions to where clause
      where.OR = searchConditions;
    }

    // Filter by company
    if (requestData.company_id) {
      where.companyId = Array.isArray(requestData.company_id)
        ? { in: requestData.company_id }
        : requestData.company_id;
    }

    // Filter by job role
    if (requestData.job_role_id) {
      where.jobRoleId = Array.isArray(requestData.job_role_id)
        ? { in: requestData.job_role_id }
        : requestData.job_role_id;
    }

    // Filter by city
    if (requestData.city_id) {
      where.cityId = Array.isArray(requestData.city_id)
        ? { in: requestData.city_id }
        : requestData.city_id;
    }

    // Filter by province (via city)
    if (requestData.province_id) {
      if (Array.isArray(requestData.province_id)) {
        where.city = {
          provinceId: { in: requestData.province_id },
        };
      } else {
        where.city = {
          provinceId: requestData.province_id,
        };
      }
    }

    // Filter by job type
    if (requestData.job_type) {
      where.jobType = Array.isArray(requestData.job_type)
        ? { in: requestData.job_type }
        : requestData.job_type;
    }

    // Filter by work system
    if (requestData.work_system) {
      where.workSystem = Array.isArray(requestData.work_system)
        ? { in: requestData.work_system }
        : requestData.work_system;
    }

    // Filter by education level
    if (requestData.education_level) {
      where.educationLevel = Array.isArray(requestData.education_level)
        ? { in: requestData.education_level }
        : requestData.education_level;
    }

    // Filter by minimum experience
    if (requestData.experience_min !== undefined) {
      where.minYearsOfExperience = { gte: requestData.experience_min };
    }

    // Filter by minimum salary
    if (requestData.salary_min !== undefined) {
      where.salaryMin = { gte: requestData.salary_min };
    }

    // Filter by status (admin can see all statuses)
    if (requestData.status) {
      where.status = Array.isArray(requestData.status)
        ? { in: requestData.status }
        : requestData.status;
    }

    const sortField =
      sortFieldMap[requestData.sort_by as keyof typeof sortFieldMap] ??
      "createdAt";
    const orderBy: any = {
      [sortField]: requestData.sort_order,
    };

    const [totalItems, records] = await Promise.all([
      prisma.job.count({ where }),
      prisma.job.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          company: true,
          jobRole: true,
          medias: {
            orderBy: {
              createdAt: "asc",
            },
          },
          city: {
            include: {
              province: true,
            },
          },
        },
      }),
    ]);

    const totalPages =
      totalItems === 0 ? 0 : Math.ceil(totalItems / Math.max(perPage, 1));

    return {
      items: records.map((record) => AdminJobService.toResponse(record)),
      pagination: {
        page,
        per_page: perPage,
        total_items: totalItems,
        total_pages: totalPages,
      },
    };
  }

  static async get(id: string): Promise<JobResponse> {
    const job = await prisma.job.findFirst({
      where: {
        id,
      },
      include: {
        company: true,
        jobRole: true,
        medias: {
          orderBy: {
            createdAt: "asc",
          },
        },
        city: {
          include: {
            province: true,
          },
        },
      },
    });

    if (!job) {
      throw new ResponseError(404, "Lowongan pekerjaan tidak ditemukan");
    }

    return AdminJobService.toResponse(job);
  }

  static async create(request: CreateJobRequest): Promise<JobResponse> {
    // Check if company exists
    const company = await prisma.company.findFirst({
      where: { id: request.company_id },
    });

    if (!company) {
      throw new ResponseError(400, "Perusahaan tidak ditemukan");
    }

    // Check if job role exists
    const jobRole = await prisma.jobRole.findFirst({
      where: { id: request.job_role_id },
    });

    if (!jobRole) {
      throw new ResponseError(400, "Job role tidak ditemukan");
    }

    // Check if city exists (if provided)
    if (request.city_id) {
      const city = await prisma.city.findFirst({
        where: { id: request.city_id },
      });

      if (!city) {
        throw new ResponseError(400, "Kota tidak ditemukan");
      }
    }

    // Check if slug is unique
    const slug = slugify(request.title, 10);
    const existingJob = await prisma.job.findFirst({
      where: { slug },
    });

    if (existingJob) {
      throw new ResponseError(400, "Slug sudah ada");
    }

    const mediaPaths = request.medias?.length
      ? await AdminJobService.prepareJobMediaFiles(request.medias)
      : [];

    const now = new Date();
    const job = await prisma.job.create({
      data: {
        companyId: request.company_id,
        jobRoleId: request.job_role_id,
        cityId: request.city_id || null,
        title: request.title,
        slug,
        jobType: request.job_type,
        workSystem: request.work_system,
        educationLevel: request.education_level,
        minYearsOfExperience: request.min_years_of_experience,
        maxYearsOfExperience: request.max_years_of_experience || null,
        description: request.description,
        requirements: request.requirements,
        salaryMin: request.salary_min || null,
        salaryMax: request.salary_max || null,
        talentQuota: request.talent_quota || null,
        jobUrl: request.job_url || null,
        contactName: request.contact_name || null,
        contactEmail: request.contact_email || null,
        contactPhone: request.contact_phone || null,
        status: request.status,
        expirationDate: request.expiration_date
          ? new Date(request.expiration_date)
          : null,
        createdAt: now,
        updatedAt: now,
        medias: mediaPaths.length
          ? {
              create: mediaPaths.map((path) => ({
                path,
                createdAt: now,
                updatedAt: now,
              })),
            }
          : undefined,
      },
      include: {
        company: true,
        jobRole: true,
        medias: {
          orderBy: {
            createdAt: "asc",
          },
        },
        city: {
          include: {
            province: true,
          },
        },
      },
    });

    return AdminJobService.toResponse(job);
  }

  static async update(
    id: string,
    request: UpdateJobRequest
  ): Promise<JobResponse> {
    await AdminJobService.findJob(id);

    // Check if company exists (if provided)
    if (request.company_id) {
      const company = await prisma.company.findFirst({
        where: { id: request.company_id },
      });

      if (!company) {
        throw new ResponseError(400, "Perusahaan tidak ditemukan");
      }
    }

    // Check if job role exists (if provided)
    if (request.job_role_id) {
      const jobRole = await prisma.jobRole.findFirst({
        where: { id: request.job_role_id },
      });

      if (!jobRole) {
        throw new ResponseError(400, "Job role tidak ditemukan");
      }
    }

    // Check if city exists (if provided)
    if (request.city_id) {
      const city = await prisma.city.findFirst({
        where: { id: request.city_id },
      });

      if (!city) {
        throw new ResponseError(400, "Kota tidak ditemukan");
      }
    }

    // Check if slug is unique (excluding current job)
    if (request.title) {
      const newSlug = slugify(request.title, 10);
      const existingJob = await prisma.job.findFirst({
        where: {
          slug: newSlug,
          NOT: { id },
        },
      });

      if (existingJob) {
        throw new ResponseError(400, "Slug sudah ada");
      }
    }

    const shouldUpdateMedias = request.medias !== undefined;
    const mediaPaths = shouldUpdateMedias
      ? await AdminJobService.prepareJobMediaFiles(request.medias ?? [])
      : [];

    const now = new Date();
    const updateData: any = {
      updatedAt: now,
    };

    if (request.company_id !== undefined) {
      updateData.companyId = request.company_id;
    }

    if (request.job_role_id !== undefined) {
      updateData.jobRoleId = request.job_role_id;
    }

    if (request.city_id !== undefined) {
      updateData.cityId = request.city_id;
    }

    if (request.title !== undefined) {
      updateData.title = request.title;
      updateData.slug = slugify(request.title, 10);
    }

    if (request.job_type !== undefined) {
      updateData.jobType = request.job_type;
    }

    if (request.work_system !== undefined) {
      updateData.workSystem = request.work_system;
    }

    if (request.education_level !== undefined) {
      updateData.educationLevel = request.education_level;
    }

    if (request.min_years_of_experience !== undefined) {
      updateData.minYearsOfExperience = request.min_years_of_experience;
    }

    if (request.max_years_of_experience !== undefined) {
      updateData.maxYearsOfExperience = request.max_years_of_experience;
    }

    if (request.description !== undefined) {
      updateData.description = request.description;
    }

    if (request.requirements !== undefined) {
      updateData.requirements = request.requirements;
    }

    if (request.salary_min !== undefined) {
      updateData.salaryMin = request.salary_min;
    }

    if (request.salary_max !== undefined) {
      updateData.salaryMax = request.salary_max;
    }

    if (request.talent_quota !== undefined) {
      updateData.talentQuota = request.talent_quota;
    }

    if (request.job_url !== undefined) {
      updateData.jobUrl = request.job_url;
    }

    if (request.contact_name !== undefined) {
      updateData.contactName = request.contact_name;
    }

    if (request.contact_email !== undefined) {
      updateData.contactEmail = request.contact_email;
    }

    if (request.contact_phone !== undefined) {
      updateData.contactPhone = request.contact_phone;
    }

    if (request.status !== undefined) {
      updateData.status = request.status;
    }

    if (request.expiration_date !== undefined) {
      updateData.expirationDate = request.expiration_date
        ? new Date(request.expiration_date)
        : null;
    }

    const job = await prisma.$transaction(async (tx) => {
      if (shouldUpdateMedias) {
        await tx.jobMedia.deleteMany({
          where: { jobId: id },
        });

        if (mediaPaths.length) {
          await tx.jobMedia.createMany({
            data: mediaPaths.map((path) => ({
              jobId: id,
              path,
              createdAt: now,
              updatedAt: now,
            })),
          });
        }
      }

      return tx.job.update({
        where: { id },
        data: updateData,
        include: {
          company: true,
          jobRole: true,
          medias: {
            orderBy: {
              createdAt: "asc",
            },
          },
          city: {
            include: {
              province: true,
            },
          },
        },
      });
    });

    return AdminJobService.toResponse(job);
  }

  static async delete(id: string): Promise<void> {
    await AdminJobService.findJob(id);
    await prisma.job.delete({
      where: { id },
    });
  }

  static async massDelete(
    ids: string[]
  ): Promise<{ message: string; deleted_count: number }> {
    // Verify all jobs exist
    const jobs = await prisma.job.findMany({
      where: {
        id: { in: ids },
      },
    });

    if (jobs.length !== ids.length) {
      throw new ResponseError(
        404,
        "Satu atau lebih lowongan pekerjaan tidak ditemukan"
      );
    }

    const result = await prisma.job.deleteMany({
      where: {
        id: { in: ids },
      },
    });

    return {
      message: `${result.count} lowongan pekerjaan berhasil dihapus`,
      deleted_count: result.count,
    };
  }

  private static async findJob(id: string): Promise<any> {
    const job = await prisma.job.findFirst({
      where: {
        id,
      },
    });

    if (!job) {
      throw new ResponseError(404, "Lowongan pekerjaan tidak ditemukan");
    }

    return job;
  }

  private static toResponse(
    job: any & {
      company?: any;
      jobRole?: any;
      city?: any & { province?: any };
      medias?: { id: string; jobId: string; path: string }[];
    }
  ): any {
    return {
      id: job.id,
      company_id: job.companyId,
      job_role_id: job.jobRoleId,
      city_id: job.cityId,
      title: job.title,
      slug: job.slug,
      job_type: job.jobType,
      work_system: job.workSystem,
      education_level: job.educationLevel,
      min_years_of_experience: job.minYearsOfExperience,
      max_years_of_experience: job.maxYearsOfExperience,
      description: job.description,
      requirements: job.requirements,
      salary_min: job.salaryMin,
      salary_max: job.salaryMax,
      talent_quota: job.talentQuota,
      job_url: job.jobUrl,
      contact_name: job.contactName,
      contact_email: job.contactEmail,
      contact_phone: job.contactPhone,
      status: job.status,
      expiration_date: job.expirationDate?.toISOString() || null,
      created_at: job.createdAt?.toISOString(),
      updated_at: job.updatedAt?.toISOString(),
      medias: job.medias
        ? job.medias.map((media) => ({
            id: media.id,
            job_id: media.jobId,
            path: media.path,
          }))
        : [],
      company: job.company || null,
      job_role: job.jobRole || null,
      city: job.city
        ? {
            ...job.city,
            province: job.city.province || null,
          }
        : null,
    };
  }

  private static normalizeJobMediaPath(value?: string | null): string | null {
    if (!value) {
      return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const normalized = trimmed.replace(/\\/g, "/").replace(/^\/+/, "");
    const prefix = "uploads/jobs/";
    if (!normalized.toLowerCase().startsWith(prefix)) {
      return null;
    }

    const relative = normalized.slice(prefix.length);
    if (!relative || relative.includes("..")) {
      return null;
    }

    return `/${normalized}`;
  }

  private static async prepareJobMediaFiles(
    entries: JobMediaPayload[]
  ): Promise<string[]> {
    const mediaPaths: string[] = [];
    const seen = new Set<string>();

    for (const entry of entries) {
      const trimmed = entry.path.trim();
      if (!trimmed) {
        continue;
      }

      if (isHttpUrl(trimmed)) {
        if (!seen.has(trimmed)) {
          mediaPaths.push(trimmed);
          seen.add(trimmed);
        }
        continue;
      }

      const normalized = AdminJobService.normalizeJobMediaPath(trimmed);
      if (normalized) {
        if (!seen.has(normalized)) {
          mediaPaths.push(normalized);
          seen.add(normalized);
        }
        continue;
      }

      try {
        const moved = await UploadService.moveFromTemp("jobs", trimmed);
        if (!seen.has(moved)) {
          mediaPaths.push(moved);
          seen.add(moved);
        }
      } catch (error) {
        throw new ResponseError(400, "Gagal memproses media");
      }
    }

    return mediaPaths;
  }
}

