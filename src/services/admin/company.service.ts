import {
  CreateCompanyRequest,
  UpdateCompanyRequest,
  CompanyListQueryParams,
  CompanyListResponse,
  CompanyResponse,
} from "../../types/job-portal-schemas";
import { validate } from "../../utils/validate.util";
import { ResponseError } from "../../utils/response-error.util";
import { UploadService } from "../upload.service";
import { prisma } from "../../config/prisma.config";
import { slugify } from "../../utils/slugify.util";
import { CompanyValidation } from "../../validations/admin/company.validation";

const sortFieldMap = {
  created_at: "createdAt",
  updated_at: "updatedAt",
  name: "name",
  employee_size: "employeeSize",
} as const;

export class AdminCompanyService {
  static async list(query: unknown): Promise<CompanyListResponse> {
    const requestData = validate(CompanyValidation.LIST_QUERY, query);

    const page = requestData.page;
    const perPage = requestData.per_page;

    const where: any = {};

    // Search functionality
    if (requestData.q) {
      where.OR = [
        { name: { contains: requestData.q } },
        { slug: { contains: requestData.q } },
        { businessSector: { contains: requestData.q } },
        { websiteUrl: { contains: requestData.q } },
      ];
    }

    if (requestData.employee_size?.length) {
      where.employeeSize = { in: requestData.employee_size };
    }

    if (requestData.business_sector?.length) {
      where.businessSector = { in: requestData.business_sector };
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
          await prisma.company.findMany({
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
          prisma.company.count({ where }),
          prisma.company.findMany({
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
            case "employee_size":
              left = a.employeeSize ?? "";
              right = b.employeeSize ?? "";
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
      items: pagedRecords.map((record) => AdminCompanyService.toResponse(record)),
      pagination: {
        page,
        per_page: perPage,
        total_items: totalFilteredItems,
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
    const slug = slugify(request.name);
    const existingCompany = await prisma.company.findFirst({
      where: { slug },
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
        slug,
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
    if (request.name) {
      const newSlug = slugify(request.name);
      const existingCompany = await prisma.company.findFirst({
        where: {
          slug: newSlug,
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
      updateData.slug = slugify(request.name);
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
