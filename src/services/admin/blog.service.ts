import type {
  Blog as PrismaBlog,
  BlogCategory as PrismaBlogCategory,
  BlogTag as PrismaBlogTag,
  Prisma,
} from "../../generated/prisma/client";
import type {
  Blog as BlogResponse,
  BlogCategory,
  BlogTag,
  Pagination,
} from "../../types/api-schemas";
import { prisma } from "../../config/prisma.config";
import { validate } from "../../utils/validate.util";
import { z } from "zod";
import { ResponseError } from "../../utils/response-error.util";
import { UploadService } from "../upload.service";
import { BlogValidation } from "../../validations/admin/blog.validation";

type BlogListResult = {
  items: BlogResponse[];
  pagination: Pagination;
};

type CreateBlogRequest = {
  title: string;
  slug: string;
  excerpt?: string | null;
  content: string;
  featured_image?: string | null;
  status: "draft" | "published" | "archived";
  read_time?: number | null;
  category_id: string;
  author_id: string;
  tag_ids?: string[];
};

type UpdateBlogRequest = {
  title?: string;
  slug?: string;
  excerpt?: string | null;
  content?: string;
  featured_image?: string | null;
  status?: "draft" | "published" | "archived";
  read_time?: number | null;
  category_id?: string;
  author_id?: string;
  tag_ids?: string[];
};

// Schemas moved to BlogValidation

const sortFieldMap = {
  created_at: "createdAt",
  updated_at: "updatedAt",
  published_at: "publishedAt",
  title: "title",
  views: "views",
  status: "status",
} as const;

export class BlogService {
  static async list(query: unknown): Promise<BlogListResult> {
    const requestData = validate(BlogValidation.LIST_QUERY, query);
    const page = requestData.page;
    const perPage = requestData.per_page;

    const where: Prisma.BlogWhereInput = {};

    if (requestData.q) {
      const search = requestData.q;
      where.OR = [
        { title: { contains: search } },
        { excerpt: { contains: search } },
        { content: { contains: search } },
      ];
    }

    if (requestData.status) {
      where.status = requestData.status;
    }

    if (requestData.category_id) {
      where.categoryId = requestData.category_id;
    }

    if (requestData.author_id) {
      where.userId = requestData.author_id;
    }

    if (requestData.published_from || requestData.published_to) {
      where.publishedAt = {};

      if (requestData.published_from) {
        where.publishedAt.gte = new Date(
          `${requestData.published_from}T00:00:00.000Z`
        );
      }

      if (requestData.published_to) {
        where.publishedAt.lte = new Date(
          `${requestData.published_to}T23:59:59.999Z`
        );
      }
    }

    const sortField =
      sortFieldMap[requestData.sort_by as keyof typeof sortFieldMap] ??
      "createdAt";
    const orderBy: Prisma.BlogOrderByWithRelationInput = {
      [sortField]: requestData.sort_order,
    };

    const [totalItems, records] = await Promise.all([
      prisma.blog.count({ where }),
      prisma.blog.findMany({
        where,
        orderBy,
        skip: (page - 1) * perPage,
        take: perPage,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              avatar: true,
            },
          },
          category: true,
          tags: {
            include: {
              tag: true,
            },
          },
        },
      }),
    ]);

    const totalPages =
      totalItems === 0 ? 0 : Math.ceil(totalItems / Math.max(perPage, 1));

    return {
      items: records.map((record) => BlogService.toResponse(record)),
      pagination: {
        page,
        per_page: perPage,
        total_items: totalItems,
        total_pages: totalPages,
      },
    };
  }

  static async get(id: string): Promise<BlogResponse> {
    const blog = await prisma.blog.findFirst({
      where: {
        id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
        category: true,
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    if (!blog) {
      throw new ResponseError(404, "Blog tidak ditemukan");
    }

    return BlogService.toResponse(blog);
  }

  static async create(request: CreateBlogRequest): Promise<BlogResponse> {
    const requestData = validate(BlogValidation.PAYLOAD, request);

    // Check if slug is unique
    const existingBlog = await prisma.blog.findFirst({
      where: { slug: requestData.slug },
    });

    if (existingBlog) {
      throw new ResponseError(400, "Slug sudah ada");
    }

    // Check if category exists
    const category = await prisma.blogCategory.findFirst({
      where: { id: requestData.category_id },
    });

    if (!category) {
      throw new ResponseError(400, "Kategori tidak ditemukan");
    }

    // Check if author exists
    const author = await prisma.user.findFirst({
      where: { id: requestData.author_id },
    });

    if (!author) {
      throw new ResponseError(400, "Penulis tidak ditemukan");
    }

    // Validate tags if provided
    if (requestData.tag_ids && requestData.tag_ids.length > 0) {
      const tags = await prisma.blogTag.findMany({
        where: { id: { in: requestData.tag_ids } },
      });

      if (tags.length !== requestData.tag_ids.length) {
        throw new ResponseError(400, "Satu atau lebih tag tidak ditemukan");
      }
    }

    // Move featured image from temp to permanent location if provided
    let finalFeaturedImage = requestData.featured_image;
    if (requestData.featured_image) {
      try {
        finalFeaturedImage = await UploadService.moveFromTemp(
          requestData.featured_image,
          "blogs",
          requestData.slug
        );
      } catch (error) {
        throw new ResponseError(400, "Gagal memproses gambar utama");
      }
    }

    const now = new Date();
    const blogData: any = {
      title: requestData.title,
      slug: requestData.slug,
      excerpt: requestData.excerpt ?? null,
      content: requestData.content,
      featuredImage: finalFeaturedImage ?? null,
      status: requestData.status,
      readTime: requestData.read_time ?? null,
      categoryId: requestData.category_id,
      userId: requestData.author_id,
      createdAt: now,
      updatedAt: now,
      publishedAt: requestData.status === "published" ? now : null,
    };

    // Remove tag_ids from main data as it's not a direct field
    const { tag_ids, ...blogCreateData } = blogData;

    const blog = await prisma.blog.create({
      data: {
        ...blogCreateData,
        tags:
          requestData.tag_ids && requestData.tag_ids.length > 0
            ? {
                create: requestData.tag_ids.map((tagId: string) => ({
                  tagId,
                })),
              }
            : undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
        category: true,
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    return BlogService.toResponse(blog);
  }

  static async update(
    id: string,
    request: UpdateBlogRequest
  ): Promise<BlogResponse> {
    await BlogService.findBlog(id);
    const requestData = validate(BlogValidation.PAYLOAD.partial(), request);

    // Check if slug is unique (excluding current blog)
    if (requestData.slug) {
      const existingBlog = await prisma.blog.findFirst({
        where: {
          slug: requestData.slug,
          NOT: { id },
        },
      });

      if (existingBlog) {
        throw new ResponseError(400, "Slug sudah ada");
      }
    }

    // Check if category exists if provided
    if (requestData.category_id) {
      const category = await prisma.blogCategory.findFirst({
        where: { id: requestData.category_id },
      });

      if (!category) {
        throw new ResponseError(400, "Kategori tidak ditemukan");
      }
    }

    // Check if author exists if provided
    if (requestData.author_id) {
      const author = await prisma.user.findFirst({
        where: { id: requestData.author_id },
      });

      if (!author) {
        throw new ResponseError(400, "Penulis tidak ditemukan");
      }
    }

    // Validate tags if provided
    if (requestData.tag_ids && requestData.tag_ids.length > 0) {
      const tags = await prisma.blogTag.findMany({
        where: { id: { in: requestData.tag_ids } },
      });

      if (tags.length !== requestData.tag_ids.length) {
        throw new ResponseError(400, "Satu atau lebih tag tidak ditemukan");
      }
    }

    // Get current blog to check status change
    const currentBlog = await prisma.blog.findUnique({
      where: { id },
    });

    // Move featured image from temp to permanent location if provided
    let finalFeaturedImage = requestData.featured_image;
    if (requestData.featured_image) {
      try {
        finalFeaturedImage = await UploadService.moveFromTemp(
          requestData.featured_image,
          "blogs",
          requestData.slug || currentBlog?.slug || id
        );
      } catch (error) {
        throw new ResponseError(400, "Gagal memproses gambar utama");
      }
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (requestData.title !== undefined) {
      updateData.title = requestData.title;
    }

    if (requestData.slug !== undefined) {
      updateData.slug = requestData.slug;
    }

    if (requestData.excerpt !== undefined) {
      updateData.excerpt = requestData.excerpt;
    }

    if (requestData.content !== undefined) {
      updateData.content = requestData.content;
    }

    if (requestData.featured_image !== undefined) {
      updateData.featuredImage = finalFeaturedImage;
    }

    if (requestData.status !== undefined) {
      updateData.status = requestData.status;
    }

    if (requestData.read_time !== undefined) {
      updateData.readTime = requestData.read_time;
    }

    if (requestData.category_id !== undefined) {
      updateData.categoryId = requestData.category_id;
    }

    if (requestData.author_id !== undefined) {
      updateData.userId = requestData.author_id;
    }

    // Set publishedAt if status is changing to published and it wasn't published before
    if (
      currentBlog?.status !== "published" &&
      requestData.status === "published"
    ) {
      updateData.publishedAt = new Date();
    }

    // Remove tag_ids from main data as it's not a direct field
    const { tag_ids, ...blogUpdateData } = updateData;

    const blog = await prisma.blog.update({
      where: { id },
      data: {
        ...blogUpdateData,
        tags: requestData.tag_ids
          ? {
              deleteMany: {},
              create: requestData.tag_ids.map((tagId: string) => ({
                tagId,
              })),
            }
          : undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
        category: true,
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    return BlogService.toResponse(blog);
  }

  static async delete(id: string): Promise<void> {
    await BlogService.findBlog(id);
    await prisma.blog.delete({
      where: { id },
    });
  }

  static async massDelete(
    request: unknown
  ): Promise<{ message: string; deleted_count: number }> {
    const { ids } = validate(BlogValidation.MASS_DELETE, request);

    // Verify all blogs exist (including already deleted ones for mass delete)
    const blogs = await prisma.blog.findMany({
      where: {
        id: { in: ids },
      },
    });

    if (blogs.length !== ids.length) {
      throw new ResponseError(404, "Satu atau lebih blog tidak ditemukan");
    }

    // Hard delete blogs
    const result = await prisma.blog.deleteMany({
      where: {
        id: { in: ids },
      },
    });

    return {
      message: `${result.count} blog berhasil dihapus`,
      deleted_count: result.count,
    };
  }

  private static async findBlog(id: string): Promise<PrismaBlog> {
    const blog = await prisma.blog.findFirst({
      where: {
        id,
      },
    });

    if (!blog) {
      throw new ResponseError(404, "Blog tidak ditemukan");
    }

    return blog;
  }

  private static toResponse(
    blog: PrismaBlog & {
      user?: any;
      category?: PrismaBlogCategory;
      tags?: { tag: PrismaBlogTag }[];
    }
  ): BlogResponse {
    return {
      id: blog.id,
      user_id: blog.userId,
      category_id: blog.categoryId,
      title: blog.title,
      slug: blog.slug,
      excerpt: blog.excerpt ?? null,
      content: blog.content,
      featured_image: blog.featuredImage ?? null,
      status: blog.status,
      read_time: blog.readTime ?? null,
      views: blog.views,
      created_at: blog.createdAt?.toISOString(),
      updated_at: blog.updatedAt?.toISOString(),
      published_at: blog.publishedAt?.toISOString() ?? null,
      user: blog.user ?? null,
      category: blog.category
        ? BlogService.toCategoryResponse(blog.category)
        : null,
      tags: blog.tags
        ? blog.tags.map((tagRelation) =>
            BlogService.toTagResponse(tagRelation.tag)
          )
        : [],
    };
  }

  private static toCategoryResponse(
    category: PrismaBlogCategory
  ): BlogCategory {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description ?? null,
      created_at: category.createdAt?.toISOString(),
      updated_at: category.updatedAt?.toISOString(),
    };
  }

  private static toTagResponse(tag: PrismaBlogTag): BlogTag {
    return {
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      created_at: tag.createdAt?.toISOString(),
      updated_at: tag.updatedAt?.toISOString(),
    };
  }
}
