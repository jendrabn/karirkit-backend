import type {
  User,
  Blog,
  BlogCategory,
  BlogTag,
  Template,
} from "../../generated/prisma/client";
import { prisma } from "../../config/prisma.config";

type SafeUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
  avatar: string | null;
  created_at: string;
  updated_at: string;
};

type SafeBlog = {
  id: string;
  user_id: string;
  category_id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  featured_image: string | null;
  status: string;
  read_time: number | null;
  views: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  user: any;
  category: any;
  tags: any[];
};

type DashboardStats = {
  total_users: number;
  total_admins: number;
  total_blogs: number;
  total_published_blogs: number;
  total_draft_blogs: number;
  total_categories: number;
  total_tags: number;
  total_templates: number;
  total_cv_templates: number;
  total_application_letter_templates: number;
  recent_users: SafeUser[];
  recent_blogs: SafeBlog[];
  blog_status_distribution: {
    draft: number;
    published: number;
    archived: number;
  };
  user_role_distribution: {
    user: number;
    admin: number;
  };
};

export class DashboardService {
  static async getStats(): Promise<DashboardStats> {
    const [
      totalUsers,
      totalAdmins,
      totalBlogs,
      totalPublishedBlogs,
      totalDraftBlogs,
      totalCategories,
      totalTags,
      totalTemplates,
      totalCvTemplates,
      totalApplicationLetterTemplates,
      recentUsers,
      recentBlogs,
      blogStatusDistribution,
      userRoleDistribution,
    ] = await Promise.all([
      // Total users
      prisma.user.count({
        where: { deletedAt: null },
      }),

      // Total admins
      prisma.user.count({
        where: { role: "admin", deletedAt: null },
      }),

      // Total blogs
      prisma.blog.count({
        where: { deletedAt: null },
      }),

      // Total published blogs
      prisma.blog.count({
        where: { status: "published", deletedAt: null },
      }),

      // Total draft blogs
      prisma.blog.count({
        where: { status: "draft", deletedAt: null },
      }),

      // Total categories
      prisma.blogCategory.count({
        where: { deletedAt: null },
      }),

      // Total tags
      prisma.blogTag.count({
        where: { deletedAt: null },
      }),

      // Total templates
      prisma.template.count({
        where: { deletedAt: null },
      }),

      // Total CV templates
      prisma.template.count({
        where: { type: "cv", deletedAt: null },
      }),

      // Total application letter templates
      prisma.template.count({
        where: { type: "application_letter", deletedAt: null },
      }),

      // Recent users (last 5)
      prisma.user.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          role: true,
          avatar: true,
          createdAt: true,
          updatedAt: true,
        },
      }),

      // Recent blogs (last 5)
      prisma.blog.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 5,
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

      // Blog status distribution
      prisma.blog.groupBy({
        by: ["status"],
        where: { deletedAt: null },
        _count: { status: true },
      }),

      // User role distribution
      prisma.user.groupBy({
        by: ["role"],
        where: { deletedAt: null },
        _count: { role: true },
      }),
    ]);

    // Process blog status distribution
    const blogStatusCounts = blogStatusDistribution.reduce(
      (acc, item) => {
        acc[item.status as keyof typeof acc] = item._count.status;
        return acc;
      },
      { draft: 0, published: 0, archived: 0 }
    );

    // Process user role distribution
    const userRoleCounts = userRoleDistribution.reduce(
      (acc, item) => {
        acc[item.role as keyof typeof acc] = item._count.role;
        return acc;
      },
      { user: 0, admin: 0 }
    );

    // Format recent blogs
    const formattedRecentBlogs = recentBlogs.map((blog) => ({
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
      category: blog.category ?? null,
      tags: blog.tags
        ? blog.tags.map((tagRelation) => ({
            id: tagRelation.tag.id,
            name: tagRelation.tag.name,
            slug: tagRelation.tag.slug,
            created_at: tagRelation.tag.createdAt?.toISOString(),
            updated_at: tagRelation.tag.updatedAt?.toISOString(),
          }))
        : [],
    }));

    // Format recent users
    const formattedRecentUsers = recentUsers.map((user) => ({
      ...user,
      created_at: user.createdAt?.toISOString(),
      updated_at: user.updatedAt?.toISOString(),
    }));

    return {
      total_users: totalUsers,
      total_admins: totalAdmins,
      total_blogs: totalBlogs,
      total_published_blogs: totalPublishedBlogs,
      total_draft_blogs: totalDraftBlogs,
      total_categories: totalCategories,
      total_tags: totalTags,
      total_templates: totalTemplates,
      total_cv_templates: totalCvTemplates,
      total_application_letter_templates: totalApplicationLetterTemplates,
      recent_users: formattedRecentUsers as SafeUser[],
      recent_blogs: formattedRecentBlogs as SafeBlog[],
      blog_status_distribution: blogStatusCounts,
      user_role_distribution: userRoleCounts,
    };
  }
}
