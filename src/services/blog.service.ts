import type {
  Blog as PrismaBlog,
  BlogCategory as PrismaBlogCategory,
  BlogTag as PrismaBlogTag,
  Prisma,
} from "../generated/prisma/client";
import type {
  Blog as BlogResponse,
  BlogCategory,
  BlogTag,
  Pagination,
  PublicUserProfile,
} from "../types/api-schemas";
import { prisma } from "../config/prisma.config";
import { validate } from "../utils/validate.util";
import { slugify } from "../utils/slugify.util";
import { calculateReadTime } from "../utils/read-time.util";
import {
  BlogValidation,
  type BlogListQuery,
  type BlogPayloadInput,
} from "../validations/blog.validation";
import { ResponseError } from "../utils/response-error.util";

type BlogListResult = {
  items: BlogResponse[];
  pagination: Pagination;
};

type BlogUserWithSocialLinks = {
  id: string;
  name: string;
  username: string;
  avatar: string | null;
  headline: string | null;
  bio: string | null;
  location: string | null;
  socialLinks?: {
    id: string;
    userId: string;
    platform: string;
    url: string;
  }[];
};

type BlogMutableFields = Omit<
  Prisma.BlogUncheckedCreateInput,
  | "id"
  | "userId"
  | "createdAt"
  | "updatedAt"
  | "publishedAt"
  | "slug"
  | "readTime"
>;

const sortFieldMap = {
  created_at: "createdAt",
  updated_at: "updatedAt",
  published_at: "publishedAt",
  title: "title",
  views: "views",
} as const;

export class BlogService {
  static async list(query: unknown): Promise<BlogListResult> {
    const filters: BlogListQuery = validate(BlogValidation.LIST_QUERY, query);
    const page = filters.page;
    const perPage = filters.per_page;

    const where: Prisma.BlogWhereInput = {
      status: filters.status,
    };

    if (filters.q) {
      const search = filters.q;
      where.OR = [
        { title: { contains: search } },
        { excerpt: { contains: search } },
        { content: { contains: search } },
      ];
    }

    if (filters.category_id) {
      where.categoryId = filters.category_id;
    }

    if (filters.tag_id) {
      where.tags = {
        some: {
          tagId: filters.tag_id,
        },
      };
    }

    if (filters.author_id) {
      where.userId = filters.author_id;
    }

    if (filters.published_from || filters.published_to) {
      where.publishedAt = {};

      if (filters.published_from) {
        where.publishedAt.gte = new Date(
          `${filters.published_from}T00:00:00.000Z`
        );
      }

      if (filters.published_to) {
        where.publishedAt.lte = new Date(
          `${filters.published_to}T23:59:59.999Z`
        );
      }
    }

    const sortField = sortFieldMap[filters.sort_by] ?? "publishedAt";
    const orderBy: Prisma.BlogOrderByWithRelationInput = {
      [sortField]: filters.sort_order,
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
              headline: true,
              bio: true,
              location: true,
              socialLinks: {
                orderBy: [{ createdAt: "asc" }, { id: "asc" }],
                select: {
                  id: true,
                  userId: true,
                  platform: true,
                  url: true,
                },
              },
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

  static async getBySlug(slug: string): Promise<BlogResponse> {
    const blog = await prisma.blog.findFirst({
      where: {
        slug,
        status: "published",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
            headline: true,
            bio: true,
            location: true,
            socialLinks: {
              orderBy: [{ createdAt: "asc" }, { id: "asc" }],
              select: {
                id: true,
                userId: true,
                platform: true,
                url: true,
              },
            },
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

    // Increment view count
    await prisma.blog.update({
      where: { id: blog.id },
      data: { views: { increment: 1 } },
    });

    return BlogService.toResponse({ ...blog, views: blog.views + 1 });
  }

  static async create(userId: string, request: unknown): Promise<BlogResponse> {
    const payload: BlogPayloadInput = validate(BlogValidation.PAYLOAD, request);
    const now = new Date();
    const data = BlogService.mapPayloadToData(payload);
    const slug = slugify(payload.title, 5);
    const readTime = calculateReadTime(payload.content);

    // Check if slug is unique
    const existingBlog = await prisma.blog.findFirst({
      where: { slug },
    });

    if (existingBlog) {
      throw new ResponseError(400, "Slug sudah ada");
    }

    // Check if category exists
    const category = await prisma.blogCategory.findFirst({
      where: { id: payload.category_id },
    });

    if (!category) {
      throw new ResponseError(400, "Kategori tidak ditemukan");
    }

    // Validate tags if provided
    if (payload.tag_ids && payload.tag_ids.length > 0) {
      const tags = await prisma.blogTag.findMany({
        where: { id: { in: payload.tag_ids } },
      });

      if (tags.length !== payload.tag_ids.length) {
        throw new ResponseError(400, "Satu atau lebih tag tidak ditemukan");
      }
    }

    const blogData: any = {
      ...data,
      slug,
      readTime,
      userId,
      createdAt: now,
      updatedAt: now,
      publishedAt: payload.status === "published" ? now : null,
    };

    // Remove tag_ids from main data as it's not a direct field
    const { tag_ids, ...blogCreateData } = blogData;

    const blog = await prisma.blog.create({
      data: {
        ...blogCreateData,
        tags:
          tag_ids && tag_ids.length > 0
            ? {
                create: tag_ids.map((tagId: string) => ({
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
            headline: true,
            bio: true,
            location: true,
            socialLinks: {
              orderBy: [{ createdAt: "asc" }, { id: "asc" }],
              select: {
                id: true,
                userId: true,
                platform: true,
                url: true,
              },
            },
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

  static async get(userId: string, id: string): Promise<BlogResponse> {
    const blog = await BlogService.findOwnedBlog(userId, id, {
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          avatar: true,
          headline: true,
          bio: true,
          location: true,
          socialLinks: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: {
              id: true,
              userId: true,
              platform: true,
              url: true,
            },
          },
        },
      },
      category: true,
      tags: {
        include: {
          tag: true,
        },
      },
    });
    return BlogService.toResponse(blog);
  }

  static async update(
    userId: string,
    id: string,
    request: unknown
  ): Promise<BlogResponse> {
    await BlogService.findOwnedBlog(userId, id);
    const payload: BlogPayloadInput = validate(BlogValidation.PAYLOAD, request);
    const data = BlogService.mapPayloadToData(payload);

    // Check if slug is unique (excluding current blog)
    if (payload.title) {
      const newSlug = slugify(payload.title, 5);
      const existingBlog = await prisma.blog.findFirst({
        where: {
          slug: newSlug,
          NOT: { id },
        },
      });

      if (existingBlog) {
        throw new ResponseError(400, "Slug sudah ada");
      }
    }

    // Check if category exists
    const category = await prisma.blogCategory.findFirst({
      where: { id: payload.category_id },
    });

    if (!category) {
      throw new ResponseError(400, "Kategori tidak ditemukan");
    }

    // Validate tags if provided
    if (payload.tag_ids && payload.tag_ids.length > 0) {
      const tags = await prisma.blogTag.findMany({
        where: { id: { in: payload.tag_ids } },
      });

      if (tags.length !== payload.tag_ids.length) {
        throw new ResponseError(400, "Satu atau lebih tag tidak ditemukan");
      }
    }

    // Get current blog to check status change
    const currentBlog = await prisma.blog.findUnique({
      where: { id },
    });

    const updateData: any = {
      ...data,
      updatedAt: new Date(),
    };

    if (payload.title) {
      updateData.slug = slugify(payload.title, 5);
    }

    // 4. Update logic to handle content updates.
    if (payload.content) {
      updateData.readTime = calculateReadTime(payload.content);
    }

    // Set publishedAt if status is changing to published and it wasn't published before
    if (currentBlog?.status !== "published" && data.status === "published") {
      updateData.publishedAt = new Date();
    }

    // Remove tag_ids from main data as it's not a direct field
    const { tag_ids, ...blogUpdateData } = updateData;

    const blog = await prisma.blog.update({
      where: { id },
      data: {
        ...blogUpdateData,
        tags: tag_ids
          ? {
              deleteMany: {},
              create: tag_ids.map((tagId: string) => ({
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
            headline: true,
            bio: true,
            location: true,
            socialLinks: {
              orderBy: [{ createdAt: "asc" }, { id: "asc" }],
              select: {
                id: true,
                userId: true,
                platform: true,
                url: true,
              },
            },
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

  static async delete(userId: string, id: string): Promise<void> {
    await BlogService.findOwnedBlog(userId, id);
    await prisma.blog.delete({
      where: { id },
    });
  }

  static async getCategories(): Promise<BlogCategory[]> {
    const categories = await prisma.blogCategory.findMany({
      where: {},
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: {
            blogs: {},
          },
        },
      },
    });

    return categories.map((category) =>
      BlogService.toCategoryResponse(category, category._count?.blogs ?? 0)
    );
  }

  static async getTags(): Promise<BlogTag[]> {
    const tags = await prisma.blogTag.findMany({
      where: {},
      orderBy: { name: "asc" },
    });

    // Get blog counts for each tag
    const tagIds = tags.map((tag) => tag.id);
    const blogCounts = await prisma.blogTagRelation.groupBy({
      by: ["tagId"],
      where: {
        tagId: { in: tagIds },
      },
      _count: {
        _all: true,
      },
    });

    const blogCountMap = blogCounts.reduce((acc, item) => {
      acc[item.tagId] = item._count._all;
      return acc;
    }, {} as Record<string, number>);

    return tags.map((tag) =>
      BlogService.toTagResponse(tag, blogCountMap[tag.id] ?? 0)
    );
  }

  private static async findOwnedBlog(
    userId: string,
    id: string,
    include?: Prisma.BlogInclude
  ): Promise<PrismaBlog & { user?: any; category?: any; tags?: any[] }> {
    const blog = await prisma.blog.findFirst({
      where: {
        id,
        userId,
      },
      include,
    });

    if (!blog) {
      throw new ResponseError(404, "Blog tidak ditemukan");
    }

    return blog;
  }

  private static mapPayloadToData(
    payload: BlogPayloadInput
  ): BlogMutableFields & { tag_ids?: string[] } {
    return {
      title: payload.title,
      // slug: payload.slug, // Removed
      excerpt: payload.excerpt ?? null,
      content: payload.content,
      featuredImage: payload.featured_image ?? null,
      status: payload.status,
      // readTime: calculateReadTime(payload.content), // Handled separately
      categoryId: payload.category_id,
      tag_ids: payload.tag_ids,
    };
  }

  private static toCategoryResponse(
    category: PrismaBlogCategory & { _count?: { blogs?: number } },
    blogCount: number = 0
  ): BlogCategory {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description ?? null,
      blog_count: blogCount,
      created_at: category.createdAt?.toISOString(),
      updated_at: category.updatedAt?.toISOString(),
    };
  }

  private static toTagResponse(
    tag: PrismaBlogTag,
    blogCount: number = 0
  ): BlogTag {
    return {
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      blog_count: blogCount,
      created_at: tag.createdAt?.toISOString(),
      updated_at: tag.updatedAt?.toISOString(),
    };
  }

  private static toPublicUser(
    user: BlogUserWithSocialLinks
  ): PublicUserProfile {
    return {
      id: user.id,
      name: user.name,
      username: user.username,
      avatar: user.avatar ?? null,
      headline: user.headline ?? null,
      bio: user.bio ?? null,
      location: user.location ?? null,
      social_links:
        user.socialLinks?.map((record) => ({
          id: record.id,
          user_id: record.userId,
          platform: record.platform,
          url: record.url,
        })) ?? [],
    };
  }

  private static toResponse(
    blog: PrismaBlog & {
      user?: BlogUserWithSocialLinks;
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
      user: blog.user ? BlogService.toPublicUser(blog.user) : undefined,
      category: blog.category
        ? BlogService.toCategoryResponse(blog.category, 0)
        : null,
      tags: blog.tags
        ? blog.tags.map((tagRelation) =>
            BlogService.toTagResponse(tagRelation.tag, 0)
          )
        : [],
    };
  }
  static async getLatest(limit: number): Promise<BlogResponse[]> {
    // Validate and clamp limit between 1-20
    const take = Math.min(Math.max(limit, 1), 20);

    const blogs = await prisma.blog.findMany({
      where: {
        status: "published",
      },
      orderBy: {
        publishedAt: "desc",
      },
      take,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
            headline: true,
            bio: true,
            location: true,
            socialLinks: {
              orderBy: [{ createdAt: "asc" }, { id: "asc" }],
              select: {
                id: true,
                userId: true,
                platform: true,
                url: true,
              },
            },
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

    return blogs.map((blog) => BlogService.toResponse(blog));
  }

  static async getPopular(
    limit: number,
    window: string
  ): Promise<BlogResponse[]> {
    const take = Math.min(Math.max(limit, 1), 20);
    const days = BlogService.parsePopularWindow(window);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const blogs = await prisma.blog.findMany({
      where: {
        status: "published",
        publishedAt: {
          gte: since,
        },
      },
      orderBy: [{ views: "desc" }, { publishedAt: "desc" }],
      take,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
            headline: true,
            bio: true,
            location: true,
            socialLinks: {
              orderBy: [{ createdAt: "asc" }, { id: "asc" }],
              select: {
                id: true,
                userId: true,
                platform: true,
                url: true,
              },
            },
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

    return blogs.map((blog) => BlogService.toResponse(blog));
  }

  static async getRelatedBlogs(
    slug: string,
    limit: number
  ): Promise<BlogResponse[]> {
    // Validate and clamp limit between 1-20
    const take = Math.min(Math.max(limit, 1), 20);

    // First, get the current blog to find its category and tags
    const currentBlog = await prisma.blog.findFirst({
      where: {
        slug,
        status: "published",
      },
      include: {
        category: true,
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    if (!currentBlog) {
      throw new ResponseError(404, "Blog tidak ditemukan");
    }

    // Extract tag IDs from the current blog
    const tagIds = currentBlog.tags.map((tagRelation) => tagRelation.tagId);
    const categoryId = currentBlog.categoryId;

    // Find related blogs based on category or tags
    const relatedBlogs = await prisma.blog.findMany({
      where: {
        AND: [
          { status: "published" },
          { id: { not: currentBlog.id } }, // Exclude the current blog
          {
            OR: [
              { categoryId: categoryId }, // Same category
              {
                tags: {
                  some: {
                    tagId: { in: tagIds }, // Same tags
                  },
                },
              },
            ],
          },
        ],
      },
      orderBy: [
        { publishedAt: "desc" }, // Prioritize more recent blogs
        { views: "desc" }, // Then by popularity
      ],
      take,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
            headline: true,
            bio: true,
            location: true,
            socialLinks: {
              orderBy: [{ createdAt: "asc" }, { id: "asc" }],
              select: {
                id: true,
                userId: true,
                platform: true,
                url: true,
              },
            },
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

    return relatedBlogs.map((blog) => BlogService.toResponse(blog));
  }

  private static parsePopularWindow(value: string): number {
    switch (value) {
      case "1d":
        return 1;
      case "30d":
        return 30;
      case "7d":
      default:
        return 7;
    }
  }
}
