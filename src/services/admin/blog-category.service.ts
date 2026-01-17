import type {
  BlogCategory as PrismaBlogCategory,
  Prisma,
} from "../../generated/prisma/client";
import type { BlogCategory } from "../../types/api-schemas";
import { prisma } from "../../config/prisma.config";
import { validate } from "../../utils/validate.util";
import { ResponseError } from "../../utils/response-error.util";
import { BlogCategoryValidation } from "../../validations/admin/blog-category.validation";
import { slugify } from "../../utils/slugify.util";

type BlogCategoryListResult = {
  items: BlogCategory[];
  pagination: {
    page: number;
    per_page: number;
    total_items: number;
    total_pages: number;
  };
};

type CreateBlogCategoryRequest = {
  name: string;
  description?: string | null;
};

type UpdateBlogCategoryRequest = {
  name?: string;
  description?: string | null;
};

// Schemas moved to BlogCategoryValidation

const sortFieldMap = {
  created_at: "createdAt",
  updated_at: "updatedAt",
  name: "name",
} as const;

export class BlogCategoryService {
  static async list(query: unknown): Promise<BlogCategoryListResult> {
    const requestData = validate(BlogCategoryValidation.LIST_QUERY, query);
    const page = requestData.page;
    const perPage = requestData.per_page;

    const where: Prisma.BlogCategoryWhereInput = {};

    if (requestData.q) {
      const search = requestData.q;
      where.OR = [
        { name: { contains: search } },
        { slug: { contains: search } },
        { description: { contains: search } },
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
          await prisma.blogCategory.findMany({
            where,
            include: {
              _count: {
                select: {
                  blogs: {},
                },
              },
            },
          }),
        ]
      : await Promise.all([
          prisma.blogCategory.count({ where }),
          prisma.blogCategory.findMany({
            where,
            orderBy: {
              [sortFieldMap[requestData.sort_by as keyof typeof sortFieldMap] ??
              "name"]: requestData.sort_order,
            },
            skip: (page - 1) * perPage,
            take: perPage,
            include: {
              _count: {
                select: {
                  blogs: {},
                },
              },
            },
          }),
        ]);

    const filteredRecords = needsDerivedData
      ? records.filter((record) => {
          if (
            requestData.blog_count_from !== undefined &&
            record._count.blogs < requestData.blog_count_from
          ) {
            return false;
          }
          if (
            requestData.blog_count_to !== undefined &&
            record._count.blogs > requestData.blog_count_to
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
            case "blog_count":
              left = a._count.blogs;
              right = b._count.blogs;
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
      items: pagedRecords.map((record) => BlogCategoryService.toResponse(record)),
      pagination: {
        page,
        per_page: perPage,
        total_items: totalFilteredItems,
        total_pages: totalPages,
      },
    };
  }

  static async get(id: string): Promise<BlogCategory> {
    const category = await prisma.blogCategory.findFirst({
      where: {
        id,
      },
    });

    if (!category) {
      throw new ResponseError(404, "Kategori blog tidak ditemukan");
    }

    return BlogCategoryService.toResponse(category);
  }

  static async create(
    request: CreateBlogCategoryRequest
  ): Promise<BlogCategory> {
    const requestData = validate(BlogCategoryValidation.PAYLOAD, request);

    // Check if name is unique
    const existingName = await prisma.blogCategory.findFirst({
      where: { name: requestData.name },
    });

    if (existingName) {
      throw new ResponseError(400, "Nama kategori sudah ada");
    }

    // Check if slug is unique
    const slug = slugify(requestData.name);
    const existingSlug = await prisma.blogCategory.findFirst({
      where: { slug },
    });

    if (existingSlug) {
      throw new ResponseError(400, "Slug kategori sudah ada");
    }

    const category = await prisma.blogCategory.create({
      data: {
        name: requestData.name,
        slug,
        description: requestData.description ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return BlogCategoryService.toResponse(category);
  }

  static async update(
    id: string,
    request: UpdateBlogCategoryRequest
  ): Promise<BlogCategory> {
    // Check if category exists
    const existingCategory = await prisma.blogCategory.findFirst({
      where: { id },
    });

    if (!existingCategory) {
      throw new ResponseError(404, "Kategori blog tidak ditemukan");
    }

    const requestData = validate(
      BlogCategoryValidation.PAYLOAD.partial(),
      request
    );

    // Check if name is unique (excluding current category)
    if (requestData.name && requestData.name !== existingCategory.name) {
      const nameExists = await prisma.blogCategory.findFirst({
        where: {
          name: requestData.name,
          NOT: { id },
        },
      });

      if (nameExists) {
        throw new ResponseError(400, "Nama kategori sudah ada");
      }
    }

    // Check if slug is unique (excluding current category)
    if (requestData.name && requestData.name !== existingCategory.name) {
      const newSlug = slugify(requestData.name);
      const slugExists = await prisma.blogCategory.findFirst({
        where: {
          slug: newSlug,
          NOT: { id },
        },
      });

      if (slugExists) {
        throw new ResponseError(400, "Slug kategori sudah ada");
      }
    }

    const updateData: Prisma.BlogCategoryUpdateInput = {
      updatedAt: new Date(),
    };

    if (requestData.name !== undefined) {
      updateData.name = requestData.name;
      updateData.slug = slugify(requestData.name);
    }

    if (requestData.description !== undefined) {
      updateData.description = requestData.description;
    }

    const category = await prisma.blogCategory.update({
      where: { id },
      data: updateData,
    });

    return BlogCategoryService.toResponse(category);
  }

  static async delete(id: string): Promise<void> {
    // Check if category exists
    const existingCategory = await prisma.blogCategory.findFirst({
      where: { id },
    });

    if (!existingCategory) {
      throw new ResponseError(404, "Kategori blog tidak ditemukan");
    }

    // Check if category is being used by any blogs
    const blogsUsingCategory = await prisma.blog.count({
      where: {
        categoryId: id,
      },
    });

    if (blogsUsingCategory > 0) {
      throw new ResponseError(
        400,
        "Tidak dapat menghapus kategori yang sedang digunakan oleh blog"
      );
    }

    // Hard delete
    await prisma.blogCategory.delete({
      where: { id },
    });
  }

  static async massDelete(
    request: unknown
  ): Promise<{ message: string; deleted_count: number }> {
    const { ids } = validate(BlogCategoryValidation.MASS_DELETE, request);

    // Verify all categories exist
    const categories = await prisma.blogCategory.findMany({
      where: {
        id: { in: ids },
      },
    });

    if (categories.length !== ids.length) {
      throw new ResponseError(
        404,
        "Satu atau lebih kategori blog tidak ditemukan"
      );
    }

    // Check if any categories are being used by blogs
    const blogsUsingCategories = await prisma.blog.count({
      where: {
        categoryId: { in: ids },
      },
    });

    if (blogsUsingCategories > 0) {
      throw new ResponseError(
        400,
        "Tidak dapat menghapus kategori yang sedang digunakan oleh blog"
      );
    }

    // Hard delete categories
    const result = await prisma.blogCategory.deleteMany({
      where: {
        id: { in: ids },
      },
    });

    return {
      message: `${result.count} kategori blog berhasil dihapus`,
      deleted_count: result.count,
    };
  }

  private static toResponse(
    category: PrismaBlogCategory & { _count?: { blogs?: number } }
  ): BlogCategory {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description ?? null,
      blog_count: category._count?.blogs ?? 0,
      created_at: category.createdAt?.toISOString(),
      updated_at: category.updatedAt?.toISOString(),
    };
  }
}
