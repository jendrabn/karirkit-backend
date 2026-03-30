import type { Template, Prisma } from "../../generated/prisma/client";
import type {
  TemplateOrderByWithRelationInput,
  TemplateWhereInput,
} from "../../generated/prisma/models/Template";
import { prisma } from "../../config/prisma.config";
import { ResponseError } from "../../utils/response-error.util";
import { validate } from "../../utils/validate.util";
import { z } from "zod";
import { UploadService } from "../upload.service";
import { TemplateValidation } from "../../validations/admin/template.validation";
import { isHttpUrl } from "../../utils/url.util";

type TemplateListResult = {
  items: TemplateResponse[];
  pagination: {
    page: number;
    per_page: number;
    total_items: number;
    total_pages: number;
  };
};

type TemplateResponse = {
  id: string;
  name: string;
  type: Template["type"];
  language: Template["language"];
  path: string;
  preview: string | null;
  is_premium: boolean;
  created_at: string;
  updated_at: string;
};

type CreateTemplateRequest = {
  name: string;
  type: "cv" | "application_letter";
  language?: "en" | "id";
  path: string;
  preview?: string;
  is_premium?: boolean;
};

type UpdateTemplateRequest = {
  name?: string;
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

    const where: TemplateWhereInput = {};

    if (requestData.q) {
      const search = requestData.q;
      where.OR = [{ name: { contains: search } }];
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

    if (requestData.updated_at_from || requestData.updated_at_to) {
      where.updatedAt = {};
      if (requestData.updated_at_from) {
        where.updatedAt.gte = new Date(
          `${requestData.updated_at_from}T00:00:00.000Z`
        );
      }
      if (requestData.updated_at_to) {
        where.updatedAt.lte = new Date(
          `${requestData.updated_at_to}T23:59:59.999Z`
        );
      }
    }

    const sortField =
      sortFieldMap[requestData.sort_by as keyof typeof sortFieldMap] ??
      "createdAt";
    const orderBy: TemplateOrderByWithRelationInput = {
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
      items: records.map((record) => TemplateService.toResponse(record)),
      pagination: {
        page,
        per_page: perPage,
        total_items: totalItems,
        total_pages: totalPages,
      },
    };
  }

  static async get(id: string): Promise<TemplateResponse> {
    const template = await prisma.template.findFirst({
      where: {
        id,
      },
    });

    if (!template) {
      throw new ResponseError(404, "Template tidak ditemukan");
    }

    return TemplateService.toResponse(template);
  }

  static async create(
    request: CreateTemplateRequest
  ): Promise<TemplateResponse> {
    const requestData = validate(TemplateValidation.PAYLOAD, request);

    // Move file from temp to permanent location if path is provided
    let finalPath = requestData.path;
    let movedTemplatePath: string | undefined;
    if (requestData.path && UploadService.isTempUploadPath(requestData.path)) {
      try {
        movedTemplatePath = await UploadService.moveFromTemp(
          "templates",
          requestData.path
        );
        finalPath = movedTemplatePath;
      } catch (error) {
        console.error(error);
        throw new ResponseError(400, "Gagal memproses file template");
      }
    }

    // Move preview file from temp to permanent location if preview is provided
    let finalPreviewPath = requestData.preview;
    let movedPreviewPath: string | undefined;
    if (
      requestData.preview &&
      !isHttpUrl(requestData.preview) &&
      UploadService.isTempUploadPath(requestData.preview)
    ) {
      try {
        movedPreviewPath = await UploadService.moveFromTemp(
          "templates",
          requestData.preview
        );
        finalPreviewPath = movedPreviewPath;
      } catch (error) {
        throw new ResponseError(400, "Gagal memproses file preview");
      }
    }

    try {
      const template = await prisma.template.create({
        data: {
          name: requestData.name,
          type: requestData.type,
          language: requestData.language ?? "en",
          path: finalPath,
          preview: finalPreviewPath,
          isPremium: requestData.is_premium ?? false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      return TemplateService.toResponse(template);
    } catch (error) {
      await Promise.all([
        UploadService.deleteUpload(movedTemplatePath, ["uploads/templates"]),
        UploadService.deleteUpload(movedPreviewPath, ["uploads/templates"]),
      ]);
      throw error;
    }
  }

  static async update(
    id: string,
    request: UpdateTemplateRequest
  ): Promise<TemplateResponse> {
    // Check if template exists
    const existingTemplate = await prisma.template.findFirst({
      where: { id },
    });

    if (!existingTemplate) {
      throw new ResponseError(404, "Template tidak ditemukan");
    }

    const requestData = validate(TemplateValidation.PAYLOAD.partial(), request);

    // Move file from temp to permanent location if path is provided
    let finalPath = requestData.path;
    let movedTemplatePath: string | undefined;
    if (requestData.path && UploadService.isTempUploadPath(requestData.path)) {
      try {
        movedTemplatePath = await UploadService.moveFromTemp(
          "templates",
          requestData.path
        );
        finalPath = movedTemplatePath;
      } catch (error) {
        throw new ResponseError(400, "Gagal memproses file template");
      }
    }

    // Move preview file from temp to permanent location if preview is provided
    let finalPreviewPath = requestData.preview;
    let movedPreviewPath: string | undefined;
    if (
      requestData.preview &&
      !isHttpUrl(requestData.preview) &&
      UploadService.isTempUploadPath(requestData.preview)
    ) {
      try {
        movedPreviewPath = await UploadService.moveFromTemp(
          "templates",
          requestData.preview
        );
        finalPreviewPath = movedPreviewPath;
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

    try {
      const template = await prisma.template.update({
        where: { id },
        data: updateData,
      });

      await Promise.all([
        requestData.path !== undefined && existingTemplate.path !== template.path
          ? UploadService.deleteUpload(existingTemplate.path, [
              "uploads/templates",
            ])
          : Promise.resolve(),
        requestData.preview !== undefined &&
        existingTemplate.preview !== template.preview
          ? UploadService.deleteUpload(existingTemplate.preview, [
              "uploads/templates",
            ])
          : Promise.resolve(),
      ]);

      return TemplateService.toResponse(template);
    } catch (error) {
      await Promise.all([
        UploadService.deleteUpload(movedTemplatePath, ["uploads/templates"]),
        UploadService.deleteUpload(movedPreviewPath, ["uploads/templates"]),
      ]);
      throw error;
    }
  }

  static async delete(id: string): Promise<void> {
    const existingTemplate = await prisma.template.findFirst({
      where: { id },
      include: {
        _count: {
          select: {
            cvs: true,
            applicationLetters: true,
          },
        },
      },
    });

    if (!existingTemplate) {
      throw new ResponseError(404, "Template tidak ditemukan");
    }

    if (
      existingTemplate._count.cvs > 0 ||
      existingTemplate._count.applicationLetters > 0
    ) {
      throw new ResponseError(
        400,
        "Template tidak dapat dihapus karena masih digunakan"
      );
    }

    await prisma.template.delete({
      where: { id },
    });
    await Promise.all([
      UploadService.deleteUpload(existingTemplate.path, ["uploads/templates"]),
      UploadService.deleteUpload(existingTemplate.preview, ["uploads/templates"]),
    ]);
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
      include: {
        _count: {
          select: {
            cvs: true,
            applicationLetters: true,
          },
        },
      },
    });

    if (templates.length !== ids.length) {
      throw new ResponseError(404, "Satu atau lebih template tidak ditemukan");
    }

    if (
      templates.some(
        (template) =>
          template._count.cvs > 0 || template._count.applicationLetters > 0
      )
    ) {
      throw new ResponseError(
        400,
        "Satu atau lebih template tidak dapat dihapus karena masih digunakan"
      );
    }

    const result = await prisma.template.deleteMany({
      where: {
        id: { in: ids },
      },
    });

    await Promise.all(
      templates.flatMap((template) => [
        UploadService.deleteUpload(template.path, ["uploads/templates"]),
        UploadService.deleteUpload(template.preview, ["uploads/templates"]),
      ])
    );

    return {
      message: `${result.count} template berhasil dihapus`,
      deleted_count: result.count,
    };
  }

  private static toResponse(template: Template): TemplateResponse {
    return {
      id: template.id,
      name: template.name,
      type: template.type,
      language: template.language,
      path: template.path,
      preview: template.preview,
      is_premium: template.isPremium,
      created_at: template.createdAt.toISOString(),
      updated_at: template.updatedAt.toISOString(),
    };
  }
}
