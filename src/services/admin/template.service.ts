import type { Template, Prisma } from "../../generated/prisma/client";
import { prisma } from "../../config/prisma.config";
import { ResponseError } from "../../utils/response-error.util";
import { validate } from "../../utils/validate.util";
import { z } from "zod";
import { UploadService } from "../upload.service";

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
  is_premium?: boolean;
};

type UpdateTemplateRequest = {
  name?: string;
  slug?: string;
  type?: "cv" | "application_letter";
  language?: "en" | "id";
  path?: string;
  is_premium?: boolean;
};

// Add validation schema for admin template list
const AdminTemplateListQuery = z.object({
  page: z.coerce.number().min(1).default(1),
  per_page: z.coerce.number().min(1).max(100).default(20),
  q: z.string().optional(),
  sort_by: z
    .enum([
      "created_at",
      "updated_at",
      "name",
      "type",
      "language",
      "is_premium",
    ])
    .default("created_at"),
  sort_order: z.enum(["asc", "desc"]).default("desc"),
  type: z.enum(["cv", "application_letter"]).optional(),
  language: z.enum(["en", "id"]).optional(),
  is_premium: z.coerce.boolean().optional(),
});

// Add validation schema for create/update template
const TemplatePayload = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  type: z.enum(["cv", "application_letter"]),
  language: z.enum(["en", "id"]).default("en"),
  path: z.string().min(1),
  is_premium: z.boolean().default(false),
});

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
    const requestData = validate(AdminTemplateListQuery, query);
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
      throw new ResponseError(404, "Template not found");
    }

    return template;
  }

  static async create(request: CreateTemplateRequest): Promise<Template> {
    const requestData = validate(TemplatePayload, request);

    // Check if slug is unique
    const existingTemplate = await prisma.template.findFirst({
      where: { slug: requestData.slug },
    });

    if (existingTemplate) {
      throw new ResponseError(400, "Slug already exists");
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
        throw new ResponseError(400, "Failed to process template file");
      }
    }

    const template = await prisma.template.create({
      data: {
        name: requestData.name,
        slug: requestData.slug,
        type: requestData.type,
        language: requestData.language ?? "en",
        path: finalPath,
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
      throw new ResponseError(404, "Template not found");
    }

    const requestData = validate(TemplatePayload.partial(), request);

    // Check if slug is unique (excluding current template)
    if (requestData.slug && requestData.slug !== existingTemplate.slug) {
      const slugExists = await prisma.template.findFirst({
        where: {
          slug: requestData.slug,
          NOT: { id },
        },
      });

      if (slugExists) {
        throw new ResponseError(400, "Slug already exists");
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
        throw new ResponseError(400, "Failed to process template file");
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
      throw new ResponseError(404, "Template not found");
    }

    // Soft delete
    await prisma.template.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
