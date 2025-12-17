import type {
  BlogCategory as PrismaBlogCategory,
  Prisma,
} from "../../generated/prisma/client";
import type { BlogCategory } from "../../types/api-schemas";
import { prisma } from "../../config/prisma.config";
import { validate } from "../../utils/validate.util";
import { z } from "zod";
import { ResponseError } from "../../utils/response-error.util";

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
  slug: string;
  description?: string | null;
};

type UpdateBlogCategoryRequest = {
  name?: string;
  slug?: string;
  description?: string | null;
};

// Add validation schema for admin blog category list
const AdminBlogCategoryListQuery = z.object({
  page: z.coerce.number().min(1).default(1),
  per_page: z.coerce.number().min(1).max(100).default(20),
  q: z.string().optional(),
  sort_by: z.enum(["created_at", "updated_at", "name"]).default("name"),
  sort_order: z.enum(["asc", "desc"]).default("asc"),
});

// Add validation schema for create/update blog category
const BlogCategoryPayload = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
});

const sortFieldMap = {
  created_at: "createdAt",
  updated_at: "updatedAt",
  name: "name",
} as const;

export class BlogCategoryService {
  static async list(query: unknown): Promise<BlogCategoryListResult> {
    const requestData = validate(AdminBlogCategoryListQuery, query);
    const page = requestData.page;
    const perPage = requestData.per_page;

    const where: Prisma.BlogCategoryWhereInput = {
      deletedAt: null,
    };

    if (requestData.q) {
      const search = requestData.q;
      where.OR = [
        { name: { contains: search } },
        { slug: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const sortField =
      sortFieldMap[requestData.sort_by as keyof typeof sortFieldMap] ?? "name";
    const orderBy: Prisma.BlogCategoryOrderByWithRelationInput = {
      [sortField]: requestData.sort_order,
    };

    const [totalItems, records] = await Promise.all([
      prisma.blogCategory.count({ where }),
      prisma.blogCategory.findMany({
        where,
        orderBy,
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    const totalPages =
      totalItems === 0 ? 0 : Math.ceil(totalItems / Math.max(perPage, 1));

    return {
      items: records.map((record) => BlogCategoryService.toResponse(record)),
      pagination: {
        page,
        per_page: perPage,
        total_items: totalItems,
        total_pages: totalPages,
      },
    };
  }

  static async get(id: string): Promise<BlogCategory> {
    const category = await prisma.blogCategory.findFirst({
      where: {
        id,
        deletedAt: null,
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
    const requestData = validate(BlogCategoryPayload, request);

    // Check if name is unique
    const existingName = await prisma.blogCategory.findFirst({
      where: { name: requestData.name },
    });

    if (existingName) {
      throw new ResponseError(400, "Nama kategori sudah ada");
    }

    // Check if slug is unique
    const existingSlug = await prisma.blogCategory.findFirst({
      where: { slug: requestData.slug },
    });

    if (existingSlug) {
      throw new ResponseError(400, "Slug kategori sudah ada");
    }

    const category = await prisma.blogCategory.create({
      data: {
        name: requestData.name,
        slug: requestData.slug,
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
      where: { id, deletedAt: null },
    });

    if (!existingCategory) {
      throw new ResponseError(404, "Kategori blog tidak ditemukan");
    }

    const requestData = validate(BlogCategoryPayload.partial(), request);

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
    if (requestData.slug && requestData.slug !== existingCategory.slug) {
      const slugExists = await prisma.blogCategory.findFirst({
        where: {
          slug: requestData.slug,
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
    }

    if (requestData.slug !== undefined) {
      updateData.slug = requestData.slug;
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
      where: { id, deletedAt: null },
    });

    if (!existingCategory) {
      throw new ResponseError(404, "Kategori blog tidak ditemukan");
    }

    // Check if category is being used by any blogs
    const blogsUsingCategory = await prisma.blog.count({
      where: {
        categoryId: id,
        deletedAt: null,
      },
    });

    if (blogsUsingCategory > 0) {
      throw new ResponseError(
        400,
        "Tidak dapat menghapus kategori yang sedang digunakan oleh blog"
      );
    }

    // Soft delete
    await prisma.blogCategory.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private static toResponse(category: PrismaBlogCategory): BlogCategory {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description ?? null,
      created_at: category.createdAt?.toISOString(),
      updated_at: category.updatedAt?.toISOString(),
    };
  }
}
