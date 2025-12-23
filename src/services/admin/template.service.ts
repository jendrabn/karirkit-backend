import type { Template, Prisma } from "../../generated/prisma/client";
import { prisma } from "../../config/prisma.config";
import { ResponseError } from "../../utils/response-error.util";
import { validate } from "../../utils/validate.util";
import { z } from "zod";
import { UploadService } from "../upload.service";
import { TemplateValidation } from "../../validations/admin/template.validation";

type TemplateListResult = {
  items: Template[];
  pagination: {
    page: number;
    per_page: number;
    total_items: number;
    total_pages: number;
  };
};

type CreateTemplateRequest = {
  name: string;
  slug: string;
  type: "cv" | "application_letter";
  language?: "en" | "id";
  path: string;
  preview?: string;
  is_premium?: boolean;
};

type UpdateTemplateRequest = {
  name?: string;
  slug?: string;
  type?: "cv" | "application_letter";
  language?: "en" | "id";
  path?: string;
  preview?: string;
  is_premium?: boolean;
};

// Schemas moved to TemplateValidation

const sortFieldMap = {
  created_at: "createdAt",
  updated_at: "updatedAt",
  name: "name",
  type: "type",
  language: "language",
  is_premium: "isPremium",
} as const;

export class TemplateService {
  static async list(query: unknown): Promise<TemplateListResult> {
    const requestData = validate(TemplateValidation.LIST_QUERY, query);
    const page = requestData.page;
    const perPage = requestData.per_page;

    const where: Prisma.TemplateWhereInput = {
      deletedAt: null,
    };

    if (requestData.q) {
      const search = requestData.q;
      where.OR = [
        { name: { contains: search } },
        { slug: { contains: search } },
      ];
    }

    if (requestData.type) {
      where.type = requestData.type;
    }

    if (requestData.language) {
      where.language = requestData.language;
    }

    if (requestData.is_premium !== undefined) {
      where.isPremium = requestData.is_premium;
    }

    const sortField =
      sortFieldMap[requestData.sort_by as keyof typeof sortFieldMap] ??
      "createdAt";
    const orderBy: Prisma.TemplateOrderByWithRelationInput = {
      [sortField]: requestData.sort_order,
    };

    const [totalItems, records] = await Promise.all([
      prisma.template.count({ where }),
      prisma.template.findMany({
        where,
        orderBy,
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    const totalPages =
      totalItems === 0 ? 0 : Math.ceil(totalItems / Math.max(perPage, 1));

    return {
      items: records,
      pagination: {
        page,
        per_page: perPage,
        total_items: totalItems,
        total_pages: totalPages,
      },
    };
  }

  static async get(id: string): Promise<Template> {
    const template = await prisma.template.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!template) {
      throw new ResponseError(404, "Template tidak ditemukan");
    }

    return template;
  }

  static async create(request: CreateTemplateRequest): Promise<Template> {
    const requestData = validate(TemplateValidation.PAYLOAD, request);

    // Check if slug is unique
    const existingTemplate = await prisma.template.findFirst({
      where: { slug: requestData.slug },
    });

    if (existingTemplate) {
      throw new ResponseError(400, "Slug sudah ada");
    }

    // Move file from temp to permanent location if path is provided
    let finalPath = requestData.path;
    if (requestData.path) {
      try {
        finalPath = await UploadService.moveFromTemp(
          requestData.path,
          "templates",
          requestData.slug
        );
      } catch (error) {
        throw new ResponseError(400, "Gagal memproses file template");
      }
    }

    // Move preview file from temp to permanent location if preview is provided
    let finalPreviewPath = requestData.preview;
    if (requestData.preview) {
      try {
        finalPreviewPath = await UploadService.moveFromTemp(
          requestData.preview,
          "templates",
          requestData.slug
        );
      } catch (error) {
        throw new ResponseError(400, "Gagal memproses file preview");
      }
    }

    const template = await prisma.template.create({
      data: {
        name: requestData.name,
        slug: requestData.slug,
        type: requestData.type,
        language: requestData.language ?? "en",
        path: finalPath,
        preview: finalPreviewPath,
        isPremium: requestData.is_premium ?? false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return template;
  }

  static async update(
    id: string,
    request: UpdateTemplateRequest
  ): Promise<Template> {
    // Check if template exists
    const existingTemplate = await prisma.template.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existingTemplate) {
      throw new ResponseError(404, "Template tidak ditemukan");
    }

    const requestData = validate(TemplateValidation.PAYLOAD.partial(), request);

    // Check if slug is unique (excluding current template)
    if (requestData.slug && requestData.slug !== existingTemplate.slug) {
      const slugExists = await prisma.template.findFirst({
        where: {
          slug: requestData.slug,
          NOT: { id },
        },
      });

      if (slugExists) {
        throw new ResponseError(400, "Slug sudah ada");
      }
    }

    // Move file from temp to permanent location if path is provided
    let finalPath = requestData.path;
    if (requestData.path) {
      try {
        finalPath = await UploadService.moveFromTemp(
          requestData.path,
          "templates",
          requestData.slug || existingTemplate.slug
        );
      } catch (error) {
        throw new ResponseError(400, "Gagal memproses file template");
      }
    }

    // Move preview file from temp to permanent location if preview is provided
    let finalPreviewPath = requestData.preview;
    if (requestData.preview) {
      try {
        finalPreviewPath = await UploadService.moveFromTemp(
          requestData.preview,
          "templates",
          requestData.slug || existingTemplate.slug
        );
      } catch (error) {
        throw new ResponseError(400, "Gagal memproses file preview");
      }
    }

    const updateData: Prisma.TemplateUpdateInput = {
      updatedAt: new Date(),
    };

    if (requestData.name !== undefined) {
      updateData.name = requestData.name;
    }

    if (requestData.slug !== undefined) {
      updateData.slug = requestData.slug;
    }

    if (requestData.type !== undefined) {
      updateData.type = requestData.type;
    }

    if (requestData.language !== undefined) {
      updateData.language = requestData.language;
    }

    if (requestData.path !== undefined) {
      updateData.path = finalPath;
    }

    if (requestData.preview !== undefined) {
      updateData.preview = finalPreviewPath;
    }

    if (requestData.is_premium !== undefined) {
      updateData.isPremium = requestData.is_premium;
    }

    const template = await prisma.template.update({
      where: { id },
      data: updateData,
    });

    return template;
  }

  static async delete(id: string): Promise<void> {
    // Check if template exists
    const existingTemplate = await prisma.template.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existingTemplate) {
      throw new ResponseError(404, "Template tidak ditemukan");
    }

    // Hard delete
    await prisma.template.delete({
      where: { id },
    });
  }

  static async massDelete(
    request: unknown
  ): Promise<{ message: string; deleted_count: number }> {
    const { ids } = validate(TemplateValidation.MASS_DELETE, request);

    // Verify all templates exist (including already deleted ones for mass delete)
    const templates = await prisma.template.findMany({
      where: {
        id: { in: ids },
      },
    });

    if (templates.length !== ids.length) {
      throw new ResponseError(404, "Satu atau lebih template tidak ditemukan");
    }

    // Hard delete templates
    const result = await prisma.template.deleteMany({
      where: {
        id: { in: ids },
      },
    });

    return {
      message: `${result.count} template berhasil dihapus`,
      deleted_count: result.count,
    };
  }
}
