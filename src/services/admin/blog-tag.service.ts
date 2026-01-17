import type {
  BlogTag as PrismaBlogTag,
  Prisma,
} from "../../generated/prisma/client";
import type { BlogTag } from "../../types/api-schemas";
import { prisma } from "../../config/prisma.config";
import { validate } from "../../utils/validate.util";
import { ResponseError } from "../../utils/response-error.util";
import { BlogTagValidation } from "../../validations/admin/blog-tag.validation";
import { slugify } from "../../utils/slugify.util";

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
};

type UpdateBlogTagRequest = {
  name?: string;
};

// Schemas moved to BlogTagValidation

const sortFieldMap = {
  created_at: "createdAt",
  updated_at: "updatedAt",
  name: "name",
} as const;

export class BlogTagService {
  static async list(query: unknown): Promise<BlogTagListResult> {
    const requestData = validate(BlogTagValidation.LIST_QUERY, query);
    const page = requestData.page;
    const perPage = requestData.per_page;

    const where: Prisma.BlogTagWhereInput = {};

    if (requestData.q) {
      const search = requestData.q;
      where.OR = [
        { name: { contains: search } },
        { slug: { contains: search } },
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
      requestData.blog_count_from !== undefined ||
      requestData.blog_count_to !== undefined ||
      requestData.sort_by === "blog_count";

    const [totalItems, records] = needsDerivedData
      ? [
          null,
          await prisma.blogTag.findMany({
            where,
          }),
        ]
      : await Promise.all([
          prisma.blogTag.count({ where }),
          prisma.blogTag.findMany({
            where,
            orderBy: {
              [sortFieldMap[requestData.sort_by as keyof typeof sortFieldMap] ??
              "name"]: requestData.sort_order,
            },
            skip: (page - 1) * perPage,
            take: perPage,
          }),
        ]);

    // Get blog counts for each tag
    const tagIds = records.map((tag) => tag.id);
    const blogCounts = await prisma.blogTagRelation.groupBy({
      by: ["tagId"],
      where: {
        tagId: { in: tagIds },
      },
      _count: {
        _all: true,
      },
    });

    // Create a map of tagId to blog count
    const blogCountMap = blogCounts.reduce((acc, item) => {
      acc[item.tagId] = item._count._all;
      return acc;
    }, {} as Record<string, number>);

    const enrichedRecords = records.map((record) => ({
      record,
      count: blogCountMap[record.id] || 0,
    }));

    const filteredRecords = needsDerivedData
      ? enrichedRecords.filter((item) => {
          if (
            requestData.blog_count_from !== undefined &&
            item.count < requestData.blog_count_from
          ) {
            return false;
          }
          if (
            requestData.blog_count_to !== undefined &&
            item.count > requestData.blog_count_to
          ) {
            return false;
          }
          return true;
        })
      : enrichedRecords;

    const sortedRecords = needsDerivedData
      ? [...filteredRecords].sort((a, b) => {
          const direction = requestData.sort_order === "asc" ? 1 : -1;
          const sortBy = requestData.sort_by;
          let left: number | string = 0;
          let right: number | string = 0;
          switch (sortBy) {
            case "name":
              left = a.record.name;
              right = b.record.name;
              break;
            case "updated_at":
              left = a.record.updatedAt?.getTime() ?? 0;
              right = b.record.updatedAt?.getTime() ?? 0;
              break;
            case "blog_count":
              left = a.count;
              right = b.count;
              break;
            case "created_at":
            default:
              left = a.record.createdAt?.getTime() ?? 0;
              right = b.record.createdAt?.getTime() ?? 0;
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
      items: pagedRecords.map((item) =>
        BlogTagService.toResponse(item.record, item.count)
      ),
      pagination: {
        page,
        per_page: perPage,
        total_items: totalFilteredItems,
        total_pages: totalPages,
      },
    };
  }

  static async get(id: string): Promise<BlogTag> {
    const tag = await prisma.blogTag.findFirst({
      where: {
        id,
      },
    });

    if (!tag) {
      throw new ResponseError(404, "Tag blog tidak ditemukan");
    }

    return BlogTagService.toResponse(tag, 0);
  }

  static async create(request: CreateBlogTagRequest): Promise<BlogTag> {
    const requestData = validate(BlogTagValidation.PAYLOAD, request);

    // Check if name is unique
    const existingName = await prisma.blogTag.findFirst({
      where: { name: requestData.name },
    });

    if (existingName) {
      throw new ResponseError(400, "Nama tag sudah ada");
    }

    // Check if slug is unique
    const slug = slugify(requestData.name);
    const existingSlug = await prisma.blogTag.findFirst({
      where: { slug },
    });

    if (existingSlug) {
      throw new ResponseError(400, "Slug tag sudah ada");
    }

    const tag = await prisma.blogTag.create({
      data: {
        name: requestData.name,
        slug,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return BlogTagService.toResponse(tag, 0);
  }

  static async update(
    id: string,
    request: UpdateBlogTagRequest
  ): Promise<BlogTag> {
    // Check if tag exists
    const existingTag = await prisma.blogTag.findFirst({
      where: { id },
    });

    if (!existingTag) {
      throw new ResponseError(404, "Tag blog tidak ditemukan");
    }

    const requestData = validate(BlogTagValidation.PAYLOAD.partial(), request);

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
    if (requestData.name && requestData.name !== existingTag.name) {
      const newSlug = slugify(requestData.name);
      const slugExists = await prisma.blogTag.findFirst({
        where: {
          slug: newSlug,
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
      updateData.slug = slugify(requestData.name);
    }

    const tag = await prisma.blogTag.update({
      where: { id },
      data: updateData,
    });

    return BlogTagService.toResponse(tag, 0);
  }

  static async delete(id: string): Promise<void> {
    // Check if tag exists
    const existingTag = await prisma.blogTag.findFirst({
      where: { id },
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

    // Hard delete
    await prisma.blogTag.delete({
      where: { id },
    });
  }

  static async massDelete(
    request: unknown
  ): Promise<{ message: string; deleted_count: number }> {
    const { ids } = validate(BlogTagValidation.MASS_DELETE, request);

    // Verify all tags exist
    const tags = await prisma.blogTag.findMany({
      where: {
        id: { in: ids },
      },
    });

    if (tags.length !== ids.length) {
      throw new ResponseError(404, "Satu atau lebih tag blog tidak ditemukan");
    }

    // Check if any tags are being used by blogs
    const blogsUsingTags = await prisma.blogTagRelation.count({
      where: {
        tagId: { in: ids },
      },
    });

    if (blogsUsingTags > 0) {
      throw new ResponseError(
        400,
        "Tidak dapat menghapus tag yang sedang digunakan oleh blog"
      );
    }

    // Hard delete tags
    const result = await prisma.blogTag.deleteMany({
      where: {
        id: { in: ids },
      },
    });

    return {
      message: `${result.count} tag blog berhasil dihapus`,
      deleted_count: result.count,
    };
  }

  private static toResponse(tag: PrismaBlogTag, blogCount: number): BlogTag {
    return {
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      blog_count: blogCount,
      created_at: tag.createdAt?.toISOString(),
      updated_at: tag.updatedAt?.toISOString(),
    };
  }
}
