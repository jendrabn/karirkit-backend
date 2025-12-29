import { PrismaClient } from "../../generated/prisma/client";
import {
  CreateCompanyRequest,
  UpdateCompanyRequest,
  CompanyListQueryParams,
  CompanyListResponse,
  CompanyResponse,
} from "../../types/job-portal-schemas";
import { validate } from "../../utils/validate.util";
import { z } from "zod";
import { ResponseError } from "../../utils/response-error.util";
import { UploadService } from "../upload.service";
import { prisma } from "../../config/prisma.config";

const sortFieldMap = {
  created_at: "createdAt",
  updated_at: "updatedAt",
  name: "name",
} as const;

export class AdminCompanyService {
  static async list(query: unknown): Promise<CompanyListResponse> {
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
        { description: { contains: requestData.q } },
        { businessSector: { contains: requestData.q } },
      ];
    }

    const sortField =
      sortFieldMap[requestData.sort_by as keyof typeof sortFieldMap] ??
      "createdAt";
    const orderBy: any = {
      [sortField]: requestData.sort_order,
    };

    const [totalItems, records] = await Promise.all([
      prisma.company.count({ where }),
      prisma.company.findMany({
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
      items: records.map((record) => AdminCompanyService.toResponse(record)),
      pagination: {
        page,
        per_page: perPage,
        total_items: totalItems,
        total_pages: totalPages,
      },
    };
  }

  static async get(id: string): Promise<CompanyResponse> {
    const company = await prisma.company.findFirst({
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

    if (!company) {
      throw new ResponseError(404, "Perusahaan tidak ditemukan");
    }

    return AdminCompanyService.toResponse(company);
  }

  static async create(request: CreateCompanyRequest): Promise<CompanyResponse> {
    // Check if slug is unique
    const existingCompany = await prisma.company.findFirst({
      where: { slug: request.slug },
    });

    if (existingCompany) {
      throw new ResponseError(400, "Slug sudah ada");
    }

    // Move logo from temp to permanent location if provided
    let finalLogo = request.logo;
    if (request.logo) {
      try {
        finalLogo = await UploadService.moveFromTemp("companies", request.logo);
      } catch (error) {
        throw new ResponseError(400, "Gagal memproses logo");
      }
    }

    const now = new Date();
    const company = await prisma.company.create({
      data: {
        name: request.name,
        slug: request.slug,
        description: request.description || null,
        logo: finalLogo || null,
        employeeSize: request.employee_size || null,
        businessSector: request.business_sector || null,
        websiteUrl: request.website_url || null,
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

    return AdminCompanyService.toResponse(company);
  }

  static async update(
    id: string,
    request: UpdateCompanyRequest
  ): Promise<CompanyResponse> {
    await AdminCompanyService.findCompany(id);

    // Check if slug is unique (excluding current company)
    if (request.slug) {
      const existingCompany = await prisma.company.findFirst({
        where: {
          slug: request.slug,
          NOT: { id },
        },
      });

      if (existingCompany) {
        throw new ResponseError(400, "Slug sudah ada");
      }
    }

    // Move logo from temp to permanent location if provided
    let finalLogo = request.logo;
    if (request.logo) {
      try {
        finalLogo = await UploadService.moveFromTemp("companies", request.logo);
      } catch (error) {
        throw new ResponseError(400, "Gagal memproses logo");
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

    if (request.description !== undefined) {
      updateData.description = request.description;
    }

    if (request.logo !== undefined) {
      updateData.logo = finalLogo;
    }

    if (request.employee_size !== undefined) {
      updateData.employeeSize = request.employee_size;
    }

    if (request.business_sector !== undefined) {
      updateData.businessSector = request.business_sector;
    }

    if (request.website_url !== undefined) {
      updateData.websiteUrl = request.website_url;
    }

    const company = await prisma.company.update({
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

    return AdminCompanyService.toResponse(company);
  }

  static async delete(id: string): Promise<void> {
    await AdminCompanyService.findCompany(id);
    await prisma.company.delete({
      where: { id },
    });
  }

  static async massDelete(
    ids: string[]
  ): Promise<{ message: string; deleted_count: number }> {
    // Verify all companies exist
    const companies = await prisma.company.findMany({
      where: {
        id: { in: ids },
      },
    });

    if (companies.length !== ids.length) {
      throw new ResponseError(
        404,
        "Satu atau lebih perusahaan tidak ditemukan"
      );
    }

    const result = await prisma.company.deleteMany({
      where: {
        id: { in: ids },
      },
    });

    return {
      message: `${result.count} perusahaan berhasil dihapus`,
      deleted_count: result.count,
    };
  }

  private static async findCompany(id: string): Promise<any> {
    const company = await prisma.company.findFirst({
      where: {
        id,
      },
    });

    if (!company) {
      throw new ResponseError(404, "Perusahaan tidak ditemukan");
    }

    return company;
  }

  private static toResponse(
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
}
