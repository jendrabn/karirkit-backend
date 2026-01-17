import {
  CreateJobRequest,
  UpdateJobRequest,
  JobListQueryParams,
  JobListResponse,
  JobResponse,
} from "../../types/job-portal-schemas";
import { validate } from "../../utils/validate.util";
import { ResponseError } from "../../utils/response-error.util";
import { UploadService } from "../upload.service";
import { prisma } from "../../config/prisma.config";
import { slugify } from "../../utils/slugify.util";
import { isHttpUrl } from "../../utils/url.util";
import { JobValidation } from "../../validations/admin/job.validation";

const sortFieldMap = {
  created_at: "createdAt",
  updated_at: "updatedAt",
  title: "title",
  status: "status",
  salary_max: "salaryMax",
  expiration_date: "expirationDate",
} as const;

type JobMediaPayload = {
  path?: string | null;
};

export class AdminJobService {
  static async list(query: unknown): Promise<JobListResponse> {
    const requestData = validate(JobValidation.LIST_QUERY, query);

    const page = requestData.page;
    const perPage = requestData.per_page;
    const skip = (page - 1) * perPage;
    const take = perPage;

    const where: any = {};

    // Search functionality with improved full-text search
    if (requestData.q) {
      const searchTerm = requestData.q.trim();
      where.OR = [
        { title: { contains: searchTerm } },
        { slug: { contains: searchTerm } },
        { company: { name: { contains: searchTerm } } },
        { jobRole: { name: { contains: searchTerm } } },
        { city: { name: { contains: searchTerm } } },
        { contactName: { contains: searchTerm } },
        { contactEmail: { contains: searchTerm } },
      ];
    }

    // Filter by company
    if (requestData.company_id?.length) {
      where.companyId = { in: requestData.company_id };
    }

    // Filter by job role
    if (requestData.job_role_id?.length) {
      where.jobRoleId = { in: requestData.job_role_id };
    }

    // Filter by city
    if (requestData.city_id?.length) {
      where.cityId = { in: requestData.city_id };
    }

    // Filter by job type
    if (requestData.job_type?.length) {
      where.jobType = { in: requestData.job_type };
    }

    // Filter by work system
    if (requestData.work_system?.length) {
      where.workSystem = { in: requestData.work_system };
    }

    // Filter by education level
    if (requestData.education_level?.length) {
      where.educationLevel = { in: requestData.education_level };
    }

    // Filter by status (admin can see all statuses)
    if (requestData.status?.length) {
      where.status = { in: requestData.status };
    }

    if (
      requestData.salary_from !== undefined ||
      requestData.salary_to !== undefined
    ) {
      const salaryFilters: any[] = [
        { NOT: { AND: [{ salaryMin: null }, { salaryMax: null }] } },
      ];
      if (requestData.salary_from !== undefined) {
        salaryFilters.push({
          OR: [{ salaryMax: { gte: requestData.salary_from } }, { salaryMax: null }],
        });
      }
      if (requestData.salary_to !== undefined) {
        salaryFilters.push({
          OR: [{ salaryMin: { lte: requestData.salary_to } }, { salaryMin: null }],
        });
      }
      where.AND = [...(where.AND ?? []), ...salaryFilters];
    }

    if (
      requestData.years_of_experience_from !== undefined ||
      requestData.years_of_experience_to !== undefined
    ) {
      const experienceFilters: any[] = [];
      if (requestData.years_of_experience_from !== undefined) {
        experienceFilters.push({
          OR: [
            { maxYearsOfExperience: { gte: requestData.years_of_experience_from } },
            { maxYearsOfExperience: null },
          ],
        });
      }
      if (requestData.years_of_experience_to !== undefined) {
        experienceFilters.push({
          minYearsOfExperience: { lte: requestData.years_of_experience_to },
        });
      }
      if (experienceFilters.length) {
        where.AND = [...(where.AND ?? []), ...experienceFilters];
      }
    }

    if (
      requestData.expiration_date_from ||
      requestData.expiration_date_to
    ) {
      where.expirationDate = {};
      if (requestData.expiration_date_from) {
        where.expirationDate.gte = new Date(
          `${requestData.expiration_date_from}T00:00:00.000Z`
        );
      }
      if (requestData.expiration_date_to) {
        where.expirationDate.lte = new Date(
          `${requestData.expiration_date_to}T23:59:59.999Z`
        );
      }
    }

    if (requestData.created_at_from || requestData.created_at_to) {
      where.createdAt = {};
      if (requestData.created_at_from) {
        where.createdAt.gte = new Date(
          `${requestData.created_at_from}T00:00:00.000Z`
        );
      }
      if (requestData.created_at_to) {
        where.createdAt.lte = new Date(
          `${requestData.created_at_to}T23:59:59.999Z`
        );
      }
    }

    const sortField =
      sortFieldMap[requestData.sort_by as keyof typeof sortFieldMap] ??
      "createdAt";
    const orderBy =
      requestData.sort_by === "company_name"
        ? { company: { name: requestData.sort_order } }
        : { [sortField]: requestData.sort_order };

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
        ? job.medias.map(
            (media: { id: string; jobId: string; path: string }) => ({
            id: media.id,
            job_id: media.jobId,
            path: media.path,
          })
        )
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
      const trimmed = entry.path?.trim() ?? "";
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

