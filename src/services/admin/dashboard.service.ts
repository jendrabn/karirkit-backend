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
  total_accounts: number;
  total_users: number;
  total_admins: number;
  total_blogs: number;
  total_published_blogs: number;
  total_draft_blogs: number;
  total_archived_blogs: number;
  total_categories: number;
  total_tags: number;
  total_templates: number;
  total_cv_templates: number;
  total_application_letter_templates: number;
  total_jobs: number;
  total_published_jobs: number;
  total_draft_jobs: number;
  total_closed_jobs: number;
  total_archived_jobs: number;
  total_companies: number;
  total_job_roles: number;
  total_subscriptions: number;
  total_pending_subscriptions: number;
  total_paid_subscriptions: number;
  total_failed_subscriptions: number;
  total_cancelled_subscriptions: number;
  total_expired_subscriptions: number;
  total_subscription_revenue: number;
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
  user_status_distribution: {
    active: number;
    suspended: number;
    banned: number;
  };
  job_status_distribution: {
    draft: number;
    published: number;
    closed: number;
    archived: number;
  };
  subscription_status_distribution: {
    pending: number;
    paid: number;
    failed: number;
    cancelled: number;
    expired: number;
  };
};

export class DashboardService {
  static async getStats(): Promise<DashboardStats> {
    const [
      totalAccounts,
      totalCategories,
      totalTags,
      totalTemplates,
      totalCvTemplates,
      totalApplicationLetterTemplates,
      totalCompanies,
      totalJobRoles,
      totalSubscriptionRevenue,
      recentUsers,
      recentBlogs,
      blogStatusDistribution,
      userRoleDistribution,
      userStatusDistribution,
      jobStatusDistribution,
      subscriptionStatusDistribution,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.blogCategory.count(),
      prisma.blogTag.count(),
      prisma.template.count(),
      prisma.template.count({
        where: { type: "cv" },
      }),
      prisma.template.count({
        where: { type: "application_letter" },
      }),
      prisma.company.count(),
      prisma.jobRole.count(),
      prisma.subscription.aggregate({
        where: { status: "paid" },
        _sum: { amount: true },
      }),
      prisma.user.findMany({
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
      prisma.blog.findMany({
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
      prisma.blog.groupBy({
        by: ["status"],
        _count: { status: true },
      }),
      prisma.user.groupBy({
        by: ["role"],
        _count: { role: true },
      }),
      prisma.user.groupBy({
        by: ["status"],
        _count: { status: true },
      }),
      prisma.job.groupBy({
        by: ["status"],
        _count: { status: true },
      }),
      prisma.subscription.groupBy({
        by: ["status"],
        _count: { status: true },
      }),
    ]);

    const blogStatusCounts = blogStatusDistribution.reduce(
      (acc, item) => {
        acc[item.status as keyof typeof acc] = item._count.status;
        return acc;
      },
      { draft: 0, published: 0, archived: 0 }
    );

    const userRoleCounts = userRoleDistribution.reduce(
      (acc, item) => {
        acc[item.role as keyof typeof acc] = item._count.role;
        return acc;
      },
      { user: 0, admin: 0 }
    );

    const userStatusCounts = userStatusDistribution.reduce(
      (acc, item) => {
        acc[item.status as keyof typeof acc] = item._count.status;
        return acc;
      },
      { active: 0, suspended: 0, banned: 0 }
    );

    const jobStatusCounts = jobStatusDistribution.reduce(
      (acc, item) => {
        acc[item.status as keyof typeof acc] = item._count.status;
        return acc;
      },
      { draft: 0, published: 0, closed: 0, archived: 0 }
    );

    const subscriptionStatusCounts = subscriptionStatusDistribution.reduce(
      (acc, item) => {
        acc[item.status as keyof typeof acc] = item._count.status;
        return acc;
      },
      { pending: 0, paid: 0, failed: 0, cancelled: 0, expired: 0 }
    );

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

    const formattedRecentUsers = recentUsers.map((user) => ({
      ...user,
      created_at: user.createdAt?.toISOString(),
      updated_at: user.updatedAt?.toISOString(),
    }));

    return {
      total_accounts: totalAccounts,
      total_users: userRoleCounts.user,
      total_admins: userRoleCounts.admin,
      total_blogs:
        blogStatusCounts.draft +
        blogStatusCounts.published +
        blogStatusCounts.archived,
      total_published_blogs: blogStatusCounts.published,
      total_draft_blogs: blogStatusCounts.draft,
      total_archived_blogs: blogStatusCounts.archived,
      total_categories: totalCategories,
      total_tags: totalTags,
      total_templates: totalTemplates,
      total_cv_templates: totalCvTemplates,
      total_application_letter_templates: totalApplicationLetterTemplates,
      total_jobs:
        jobStatusCounts.draft +
        jobStatusCounts.published +
        jobStatusCounts.closed +
        jobStatusCounts.archived,
      total_published_jobs: jobStatusCounts.published,
      total_draft_jobs: jobStatusCounts.draft,
      total_closed_jobs: jobStatusCounts.closed,
      total_archived_jobs: jobStatusCounts.archived,
      total_companies: totalCompanies,
      total_job_roles: totalJobRoles,
      total_subscriptions:
        subscriptionStatusCounts.pending +
        subscriptionStatusCounts.paid +
        subscriptionStatusCounts.failed +
        subscriptionStatusCounts.cancelled +
        subscriptionStatusCounts.expired,
      total_pending_subscriptions: subscriptionStatusCounts.pending,
      total_paid_subscriptions: subscriptionStatusCounts.paid,
      total_failed_subscriptions: subscriptionStatusCounts.failed,
      total_cancelled_subscriptions: subscriptionStatusCounts.cancelled,
      total_expired_subscriptions: subscriptionStatusCounts.expired,
      total_subscription_revenue: totalSubscriptionRevenue._sum.amount ?? 0,
      recent_users: formattedRecentUsers as SafeUser[],
      recent_blogs: formattedRecentBlogs as SafeBlog[],
      blog_status_distribution: blogStatusCounts,
      user_role_distribution: userRoleCounts,
      user_status_distribution: userStatusCounts,
      job_status_distribution: jobStatusCounts,
      subscription_status_distribution: subscriptionStatusCounts,
    };
  }
}
