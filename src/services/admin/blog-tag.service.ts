import type {
  BlogTag as PrismaBlogTag,
  Prisma,
} from "../../generated/prisma/client";
import type { BlogTag } from "../../types/api-schemas";
import { prisma } from "../../config/prisma.config";
import { validate } from "../../utils/validate.util";
import { z } from "zod";
import { ResponseError } from "../../utils/response-error.util";

type BlogTagListResult = {
  items: BlogTag[];
  pagination: {
    page: number;
    per_page: number;
    total_items: number;
    total_pages: number;
  };
};

type CreateBlogTagRequest = {
  name: string;
  slug: string;
};

type UpdateBlogTagRequest = {
  name?: string;
  slug?: string;
};

// Add validation schema for admin blog tag list
const AdminBlogTagListQuery = z.object({
  page: z.coerce.number().min(1).default(1),
  per_page: z.coerce.number().min(1).max(100).default(20),
  q: z.string().optional(),
  sort_by: z.enum(["created_at", "updated_at", "name"]).default("name"),
  sort_order: z.enum(["asc", "desc"]).default("asc"),
});

// Add validation schema for create/update blog tag
const BlogTagPayload = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
});

const sortFieldMap = {
  created_at: "createdAt",
  updated_at: "updatedAt",
  name: "name",
} as const;

export class BlogTagService {
  static async list(query: unknown): Promise<BlogTagListResult> {
    const requestData = validate(AdminBlogTagListQuery, query);
    const page = requestData.page;
    const perPage = requestData.per_page;

    const where: Prisma.BlogTagWhereInput = {
      deletedAt: null,
    };

    if (requestData.q) {
      const search = requestData.q;
      where.OR = [
        { name: { contains: search } },
        { slug: { contains: search } },
      ];
    }

    const sortField =
      sortFieldMap[requestData.sort_by as keyof typeof sortFieldMap] ?? "name";
    const orderBy: Prisma.BlogTagOrderByWithRelationInput = {
      [sortField]: requestData.sort_order,
    };

    const [totalItems, records] = await Promise.all([
      prisma.blogTag.count({ where }),
      prisma.blogTag.findMany({
        where,
        orderBy,
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    const totalPages =
      totalItems === 0 ? 0 : Math.ceil(totalItems / Math.max(perPage, 1));

    return {
      items: records.map((record) => BlogTagService.toResponse(record)),
      pagination: {
        page,
        per_page: perPage,
        total_items: totalItems,
        total_pages: totalPages,
      },
    };
  }

  static async get(id: string): Promise<BlogTag> {
    const tag = await prisma.blogTag.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!tag) {
      throw new ResponseError(404, "Tag blog tidak ditemukan");
    }

    return BlogTagService.toResponse(tag);
  }

  static async create(request: CreateBlogTagRequest): Promise<BlogTag> {
    const requestData = validate(BlogTagPayload, request);

    // Check if name is unique
    const existingName = await prisma.blogTag.findFirst({
      where: { name: requestData.name },
    });

    if (existingName) {
      throw new ResponseError(400, "Nama tag sudah ada");
    }

    // Check if slug is unique
    const existingSlug = await prisma.blogTag.findFirst({
      where: { slug: requestData.slug },
    });

    if (existingSlug) {
      throw new ResponseError(400, "Slug tag sudah ada");
    }

    const tag = await prisma.blogTag.create({
      data: {
        name: requestData.name,
        slug: requestData.slug,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return BlogTagService.toResponse(tag);
  }

  static async update(
    id: string,
    request: UpdateBlogTagRequest
  ): Promise<BlogTag> {
    // Check if tag exists
    const existingTag = await prisma.blogTag.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existingTag) {
      throw new ResponseError(404, "Tag blog tidak ditemukan");
    }

    const requestData = validate(BlogTagPayload.partial(), request);

    // Check if name is unique (excluding current tag)
    if (requestData.name && requestData.name !== existingTag.name) {
      const nameExists = await prisma.blogTag.findFirst({
        where: {
          name: requestData.name,
          NOT: { id },
        },
      });

      if (nameExists) {
        throw new ResponseError(400, "Nama tag sudah ada");
      }
    }

    // Check if slug is unique (excluding current tag)
    if (requestData.slug && requestData.slug !== existingTag.slug) {
      const slugExists = await prisma.blogTag.findFirst({
        where: {
          slug: requestData.slug,
          NOT: { id },
        },
      });

      if (slugExists) {
        throw new ResponseError(400, "Slug tag sudah ada");
      }
    }

    const updateData: Prisma.BlogTagUpdateInput = {
      updatedAt: new Date(),
    };

    if (requestData.name !== undefined) {
      updateData.name = requestData.name;
    }

    if (requestData.slug !== undefined) {
      updateData.slug = requestData.slug;
    }

    const tag = await prisma.blogTag.update({
      where: { id },
      data: updateData,
    });

    return BlogTagService.toResponse(tag);
  }

  static async delete(id: string): Promise<void> {
    // Check if tag exists
    const existingTag = await prisma.blogTag.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existingTag) {
      throw new ResponseError(404, "Tag blog tidak ditemukan");
    }

    // Check if tag is being used by any blogs
    const blogsUsingTag = await prisma.blogTagRelation.count({
      where: {
        tagId: id,
      },
    });

    if (blogsUsingTag > 0) {
      throw new ResponseError(
        400,
        "Tidak dapat menghapus tag yang sedang digunakan oleh blog"
      );
    }

    // Soft delete
    await prisma.blogTag.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private static toResponse(tag: PrismaBlogTag): BlogTag {
    return {
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      created_at: tag.createdAt?.toISOString(),
      updated_at: tag.updatedAt?.toISOString(),
    };
  }
}
