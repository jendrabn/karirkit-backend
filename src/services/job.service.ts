import { PrismaClient } from "../generated/prisma/client";
import {
  JobListQueryParams,
  JobListResponse,
  JobResponse,
} from "../types/job-portal-schemas";
import { validate } from "../utils/validate.util";
import { z } from "zod";
import { ResponseError } from "../utils/response-error.util";
import { prisma } from "../config/prisma.config";
import { CompanyResponse } from "../types/job-portal-schemas";
import { CityResponse } from "../types/job-portal-schemas";

const sortFieldMap = {
  created_at: "createdAt",
  updated_at: "updatedAt",
  title: "title",
  salary_min: "salaryMin",
  experience_min: "minYearsOfExperience",
} as const;

export class JobService {
  static async list(query: unknown): Promise<JobListResponse> {
    const requestData = validate(
      z.object({
        page: z.coerce.number().min(1).default(1),
        per_page: z.coerce.number().min(1).max(50).default(10),
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
      }),
      query
    );

    const page = requestData.page;
    const perPage = requestData.per_page;
    const skip = (page - 1) * perPage;
    const take = perPage;

    const where: any = {
      status: "published", // Only show published jobs for public API
    };

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

    // Filter by company (single or multiple)
    if (requestData.company_id) {
      if (Array.isArray(requestData.company_id)) {
        where.companyId = { in: requestData.company_id };
      } else {
        where.companyId = requestData.company_id;
      }
    }

    // Filter by job role (single or multiple)
    if (requestData.job_role_id) {
      if (Array.isArray(requestData.job_role_id)) {
        where.jobRoleId = { in: requestData.job_role_id };
      } else {
        where.jobRoleId = requestData.job_role_id;
      }
    }

    // Filter by city (single or multiple)
    if (requestData.city_id) {
      if (Array.isArray(requestData.city_id)) {
        where.cityId = { in: requestData.city_id };
      } else {
        where.cityId = requestData.city_id;
      }
    }

    // Filter by province (via city) (single or multiple)
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

    // Filter by job type (single or multiple)
    if (requestData.job_type) {
      if (Array.isArray(requestData.job_type)) {
        where.jobType = { in: requestData.job_type };
      } else {
        where.jobType = requestData.job_type;
      }
    }

    // Filter by work system (single or multiple)
    if (requestData.work_system) {
      if (Array.isArray(requestData.work_system)) {
        where.workSystem = { in: requestData.work_system };
      } else {
        where.workSystem = requestData.work_system;
      }
    }

    // Filter by education level (single or multiple)
    if (requestData.education_level) {
      if (Array.isArray(requestData.education_level)) {
        where.educationLevel = { in: requestData.education_level };
      } else {
        where.educationLevel = requestData.education_level;
      }
    }

    // Filter by minimum experience
    if (requestData.experience_min !== undefined) {
      where.minYearsOfExperience = { gte: requestData.experience_min };
    }

    // Filter by minimum salary
    if (requestData.salary_min !== undefined) {
      where.salaryMin = { gte: requestData.salary_min };
    }

    // Filter out expired jobs - combine with search conditions if they exist
    const expirationFilter = {
      OR: [{ expirationDate: null }, { expirationDate: { gte: new Date() } }],
    };

    if (where.OR) {
      // If we already have OR conditions (from search), we need to combine them properly
      where.AND = [
        { OR: where.OR }, // Existing search conditions
        expirationFilter, // Expiration filter
      ];
      delete where.OR; // Remove the OR since we moved it to AND
    } else {
      // No search conditions, just apply expiration filter
      Object.assign(where, expirationFilter);
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
      items: records.map((record) => JobService.toResponse(record)),
      pagination: {
        page,
        per_page: perPage,
        total_items: totalItems,
        total_pages: totalPages,
      },
    };
  }

  static async getBySlug(slug: string): Promise<JobResponse> {
    const job = await prisma.job.findFirst({
      where: {
        slug,
        status: "published", // Only show published jobs for public API
        OR: [{ expirationDate: null }, { expirationDate: { gte: new Date() } }],
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

    return JobService.toResponse(job);
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
      company: job.company ? JobService.toCompanyResponse(job.company) : null,
      job_role: job.jobRole ? JobService.toJobRoleResponse(job.jobRole) : null,
      city: job.city
        ? {
            ...JobService.toCityResponse(job.city),
            province: job.city.province || null,
          }
        : null,
    };
  }

  // Company service methods for public API
  static async listCompanies(): Promise<CompanyResponse[]> {
    // Get companies that have active (published) jobs
    const companies = await prisma.company.findMany({
      where: {
        jobs: {
          some: {
            status: "published",
            OR: [
              { expirationDate: null },
              { expirationDate: { gte: new Date() } },
            ],
          },
        },
      },
      include: {
        _count: {
          select: {
            jobs: {
              where: {
                status: "published",
                OR: [
                  { expirationDate: null },
                  { expirationDate: { gte: new Date() } },
                ],
              },
            },
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return companies.map((company) => JobService.toCompanyResponse(company));
  }

  // City service methods for public API
  static async listCities(
    hasJobs: boolean = true,
    provinceId?: string
  ): Promise<CityResponse[]> {
    // Get cities that have active (published) jobs or all cities based on hasJobs parameter
    const whereCondition: any = hasJobs
      ? {
          jobs: {
            some: {
              status: "published",
              OR: [
                { expirationDate: null },
                { expirationDate: { gte: new Date() } },
              ],
            },
          },
        }
      : provinceId
      ? { provinceId }
      : {};

    const cities = await prisma.city.findMany({
      where: provinceId ? { provinceId, ...whereCondition } : whereCondition,
      include: {
        _count: {
          select: {
            jobs: hasJobs
              ? {
                  where: {
                    status: "published",
                    OR: [
                      { expirationDate: null },
                      { expirationDate: { gte: new Date() } },
                    ],
                  },
                }
              : true,
          },
        },
        province: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return cities.map((city) => JobService.toCityResponse(city));
  }

  // Job role service methods for public API
  static async listJobRoles(): Promise<any[]> {
    // Get job roles that have active (published) jobs
    const jobRoles = await prisma.jobRole.findMany({
      where: {
        jobs: {
          some: {
            status: "published",
            OR: [
              { expirationDate: null },
              { expirationDate: { gte: new Date() } },
            ],
          },
        },
      },
      include: {
        _count: {
          select: {
            jobs: {
              where: {
                status: "published",
                OR: [
                  { expirationDate: null },
                  { expirationDate: { gte: new Date() } },
                ],
              },
            },
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return jobRoles.map((jobRole) => JobService.toJobRoleResponse(jobRole));
  }

  private static toCompanyResponse(
    company: any & {
      _count?: { jobs?: number };
    }
  ): any {
    return {
      id: company.id,
      name: company.name,
      slug: company.slug,
      description: company.description,
      logo: company.logo,
      employee_size: company.employeeSize,
      business_sector: company.businessSector,
      website_url: company.websiteUrl,
      job_count: company._count?.jobs || 0,
      created_at: company.createdAt?.toISOString(),
      updated_at: company.updatedAt?.toISOString(),
    };
  }

  private static toCityResponse(
    city: any & {
      _count?: { jobs?: number };
      province?: any;
    }
  ): any {
    return {
      id: city.id,
      name: city.name,
      province_id: city.provinceId,
      job_count: city._count?.jobs || 0,
      province: city.province || null,
    };
  }

  private static toJobRoleResponse(
    jobRole: any & {
      _count?: { jobs?: number };
    }
  ): any {
    return {
      id: jobRole.id,
      name: jobRole.name,
      slug: jobRole.slug,
      job_count: jobRole._count?.jobs || 0,
      created_at: jobRole.createdAt?.toISOString(),
      updated_at: jobRole.updatedAt?.toISOString(),
    };
  }
}
