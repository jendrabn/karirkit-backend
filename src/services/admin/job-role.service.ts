import {
  CreateJobRoleRequest,
  UpdateJobRoleRequest,
  JobRoleListQueryParams,
  JobRoleListResponse,
  JobRoleResponse,
} from "../../types/job-portal-schemas";
import { validate } from "../../utils/validate.util";
import { ResponseError } from "../../utils/response-error.util";
import { prisma } from "../../config/prisma.config";
import { slugify } from "../../utils/slugify.util";
import { JobRoleValidation } from "../../validations/admin/job-role.validation";

const sortFieldMap = {
  created_at: "createdAt",
  updated_at: "updatedAt",
  name: "name",
} as const;

export class AdminJobRoleService {
  static async list(query: unknown): Promise<JobRoleListResponse> {
    const requestData = validate(JobRoleValidation.LIST_QUERY, query);

    const page = requestData.page;
    const perPage = requestData.per_page;

    const where: any = {};

    // Search functionality
    if (requestData.q) {
      where.OR = [
        { name: { contains: requestData.q } },
        { slug: { contains: requestData.q } },
      ];
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

    const needsDerivedData =
      requestData.job_count_from !== undefined ||
      requestData.job_count_to !== undefined ||
      requestData.sort_by === "job_count";

    const [totalItems, records] = needsDerivedData
      ? [
          null,
          await prisma.jobRole.findMany({
            where,
            include: {
              _count: {
                select: {
                  jobs: true,
                },
              },
            },
          }),
        ]
      : await Promise.all([
          prisma.jobRole.count({ where }),
          prisma.jobRole.findMany({
            where,
            orderBy: {
              [sortFieldMap[requestData.sort_by as keyof typeof sortFieldMap] ??
              "createdAt"]: requestData.sort_order,
            },
            skip: (page - 1) * perPage,
            take: perPage,
            include: {
              _count: {
                select: {
                  jobs: true,
                },
              },
            },
          }),
        ]);

    const filteredRecords = needsDerivedData
      ? records.filter((record) => {
          if (
            requestData.job_count_from !== undefined &&
            record._count.jobs < requestData.job_count_from
          ) {
            return false;
          }
          if (
            requestData.job_count_to !== undefined &&
            record._count.jobs > requestData.job_count_to
          ) {
            return false;
          }
          return true;
        })
      : records;

    const sortedRecords = needsDerivedData
      ? [...filteredRecords].sort((a, b) => {
          const direction = requestData.sort_order === "asc" ? 1 : -1;
          const sortBy = requestData.sort_by;
          let left: number | string = 0;
          let right: number | string = 0;
          switch (sortBy) {
            case "name":
              left = a.name;
              right = b.name;
              break;
            case "updated_at":
              left = a.updatedAt?.getTime() ?? 0;
              right = b.updatedAt?.getTime() ?? 0;
              break;
            case "job_count":
              left = a._count.jobs;
              right = b._count.jobs;
              break;
            case "created_at":
            default:
              left = a.createdAt?.getTime() ?? 0;
              right = b.createdAt?.getTime() ?? 0;
              break;
          }
          if (left < right) return -1 * direction;
          if (left > right) return 1 * direction;
          return 0;
        })
      : filteredRecords;

    const totalFilteredItems = needsDerivedData
      ? sortedRecords.length
      : totalItems ?? 0;
    const totalPages =
      totalFilteredItems === 0
        ? 0
        : Math.ceil(totalFilteredItems / Math.max(perPage, 1));
    const pagedRecords = needsDerivedData
      ? sortedRecords.slice((page - 1) * perPage, page * perPage)
      : sortedRecords;

    return {
      items: pagedRecords.map((record) => AdminJobRoleService.toResponse(record)),
      pagination: {
        page,
        per_page: perPage,
        total_items: totalFilteredItems,
        total_pages: totalPages,
      },
    };
  }

  static async get(id: string): Promise<JobRoleResponse> {
    const jobRole = await prisma.jobRole.findFirst({
      where: {
        id,
      },
      include: {
        _count: {
          select: {
            jobs: true,
          },
        },
      },
    });

    if (!jobRole) {
      throw new ResponseError(404, "Job role tidak ditemukan");
    }

    return AdminJobRoleService.toResponse(jobRole);
  }

  static async create(request: CreateJobRoleRequest): Promise<JobRoleResponse> {
    const slug = slugify(request.name);

    // Check if slug is unique
    const existingJobRole = await prisma.jobRole.findFirst({
      where: { slug },
    });

    if (existingJobRole) {
      throw new ResponseError(400, "Job role dengan nama/slug ini sudah ada");
    }

    const now = new Date();
    const jobRole = await prisma.jobRole.create({
      data: {
        name: request.name,
        slug,
        createdAt: now,
        updatedAt: now,
      },
      include: {
        _count: {
          select: {
            jobs: true,
          },
        },
      },
    });

    return AdminJobRoleService.toResponse(jobRole);
  }

  static async update(
    id: string,
    request: UpdateJobRoleRequest
  ): Promise<JobRoleResponse> {
    await AdminJobRoleService.findJobRole(id);

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (request.name !== undefined) {
      updateData.name = request.name;
      updateData.slug = slugify(request.name);

      const existingJobRole = await prisma.jobRole.findFirst({
        where: {
          slug: updateData.slug,
          NOT: { id },
        },
      });

      if (existingJobRole) {
        throw new ResponseError(400, "Job role dengan nama/slug ini sudah ada");
      }
    }

    const jobRole = await prisma.jobRole.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: {
            jobs: true,
          },
        },
      },
    });

    return {
      data: AdminJobRoleService.toResponse(jobRole),
    };
  }

  static async delete(id: string): Promise<void> {
    await AdminJobRoleService.findJobRole(id);
    await prisma.jobRole.delete({
      where: { id },
    });
  }

  static async massDelete(
    ids: string[]
  ): Promise<{ message: string; deleted_count: number }> {
    // Verify all job roles exist
    const jobRoles = await prisma.jobRole.findMany({
      where: {
        id: { in: ids },
      },
    });

    if (jobRoles.length !== ids.length) {
      throw new ResponseError(404, "Satu atau lebih job role tidak ditemukan");
    }

    const result = await prisma.jobRole.deleteMany({
      where: {
        id: { in: ids },
      },
    });

    return {
      message: `${result.count} job role berhasil dihapus`,
      deleted_count: result.count,
    };
  }

  private static async findJobRole(id: string): Promise<any> {
    const jobRole = await prisma.jobRole.findFirst({
      where: {
        id,
      },
    });

    if (!jobRole) {
      throw new ResponseError(404, "Job role tidak ditemukan");
    }

    return jobRole;
  }

  private static toResponse(
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
