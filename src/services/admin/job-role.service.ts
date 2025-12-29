import { PrismaClient } from "../../generated/prisma/client";
import {
  CreateJobRoleRequest,
  UpdateJobRoleRequest,
  JobRoleListQueryParams,
  JobRoleListResponse,
  JobRoleResponse,
} from "../../types/job-portal-schemas";
import { validate } from "../../utils/validate.util";
import { z } from "zod";
import { ResponseError } from "../../utils/response-error.util";
import { prisma } from "../../config/prisma.config";

const sortFieldMap = {
  created_at: "createdAt",
  updated_at: "updatedAt",
  name: "name",
} as const;

export class AdminJobRoleService {
  static async list(query: unknown): Promise<JobRoleListResponse> {
    const requestData = validate(
      z.object({
        page: z.coerce.number().min(1).default(1),
        per_page: z.coerce.number().min(1).max(50).default(20),
        q: z.string().optional(),
        sort_by: z
          .enum(["created_at", "updated_at", "name"])
          .default("created_at"),
        sort_order: z.enum(["asc", "desc"]).default("desc"),
      }),
      query
    );

    const page = requestData.page;
    const perPage = requestData.per_page;
    const skip = (page - 1) * perPage;
    const take = perPage;

    const where: any = {};

    // Search functionality
    if (requestData.q) {
      where.OR = [
        { name: { contains: requestData.q } },
        { slug: { contains: requestData.q } },
      ];
    }

    const sortField =
      sortFieldMap[requestData.sort_by as keyof typeof sortFieldMap] ??
      "createdAt";
    const orderBy: any = {
      [sortField]: requestData.sort_order,
    };

    const [totalItems, records] = await Promise.all([
      prisma.jobRole.count({ where }),
      prisma.jobRole.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          _count: {
            select: {
              jobs: true,
            },
          },
        },
      }),
    ]);

    const totalPages =
      totalItems === 0 ? 0 : Math.ceil(totalItems / Math.max(perPage, 1));

    return {
      items: records.map((record) => AdminJobRoleService.toResponse(record)),
      pagination: {
        page,
        per_page: perPage,
        total_items: totalItems,
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
    // Check if slug is unique
    const existingJobRole = await prisma.jobRole.findFirst({
      where: { slug: request.slug },
    });

    if (existingJobRole) {
      throw new ResponseError(400, "Slug sudah ada");
    }

    const now = new Date();
    const jobRole = await prisma.jobRole.create({
      data: {
        name: request.name,
        slug: request.slug,
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

    // Check if slug is unique (excluding current job role)
    if (request.slug) {
      const existingJobRole = await prisma.jobRole.findFirst({
        where: {
          slug: request.slug,
          NOT: { id },
        },
      });

      if (existingJobRole) {
        throw new ResponseError(400, "Slug sudah ada");
      }
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (request.name !== undefined) {
      updateData.name = request.name;
    }

    if (request.slug !== undefined) {
      updateData.slug = request.slug;
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
