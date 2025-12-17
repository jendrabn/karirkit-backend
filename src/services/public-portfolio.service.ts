import type {
  Portfolio as PrismaPortfolio,
  PortfolioMedia as PrismaPortfolioMedia,
  PortfolioTool as PrismaPortfolioTool,
  Prisma,
} from "../generated/prisma/client";
import { prisma } from "../config/prisma.config";
import type { Portfolio as PortfolioSchema } from "../types/api-schemas";
import { ResponseError } from "../utils/response-error.util";

type PortfolioWithRelations = PrismaPortfolio & {
  medias: PrismaPortfolioMedia[];
  tools: PrismaPortfolioTool[];
};

type PublicUserProfile = {
  id: string;
  name: string;
  username: string;
  avatar: string | null;
  headline: string | null;
};

const publicPortfolioInclude = {
  medias: {
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
  },
  tools: {
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
  },
} satisfies Prisma.PortfolioInclude;

export class PublicPortfolioService {
  static async listByUsername(usernameParam: string) {
    const { user, userId } = await PublicPortfolioService.findUserProfile(
      usernameParam
    );
    const portfolios = await prisma.portfolio.findMany({
      where: { userId },
      orderBy: [
        { year: "desc" as const },
        { month: "desc" as const },
        { createdAt: "desc" as const },
      ],
      include: publicPortfolioInclude,
    });

    return {
      user,
      portfolios: portfolios.map((record) =>
        PublicPortfolioService.toPortfolioResponse(record)
      ),
    };
  }

  static async getPortfolioDetail(usernameParam: string, id: string) {
    const { user, userId } = await PublicPortfolioService.findUserProfile(
      usernameParam
    );
    const portfolio = await prisma.portfolio.findFirst({
      where: {
        id,
        userId,
      },
      include: publicPortfolioInclude,
    });

    if (!portfolio) {
      throw new ResponseError(404, "Portfolio tidak ditemukan");
    }

    return {
      user,
      portfolio: PublicPortfolioService.toPortfolioResponse(portfolio),
    };
  }

  private static async findUserProfile(usernameParam: string) {
    const username = PublicPortfolioService.normalizeUsername(usernameParam);
    const user = await prisma.user.findFirst({
      where: {
        username,
        deletedAt: null,
      },
    });

    if (!user) {
      throw new ResponseError(404, "Pengguna tidak ditemukan");
    }

    const latestCv = await prisma.cv.findFirst({
      where: { userId: user.id },
      orderBy: [{ updatedAt: "desc" as const }, { createdAt: "desc" as const }],
      select: { headline: true },
    });

    const profile: PublicUserProfile = {
      id: user.id,
      name: user.name,
      username: user.username,
      avatar: user.avatar ?? null,
      headline: latestCv?.headline ?? null,
    };

    return { user: profile, userId: user.id };
  }

  private static normalizeUsername(value: string): string {
    const trimmed = value?.trim() ?? "";
    const normalized = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
    if (!normalized) {
      throw new ResponseError(404, "Pengguna tidak ditemukan");
    }
    return normalized;
  }

  private static toPortfolioResponse(
    portfolio: PortfolioWithRelations
  ): PortfolioSchema {
    return {
      id: portfolio.id,
      user_id: portfolio.userId,
      title: portfolio.title,
      slug: portfolio.slug,
      sort_description: portfolio.sortDescription,
      description: portfolio.description,
      role_title: portfolio.roleTitle,
      project_type: portfolio.projectType,
      industry: portfolio.industry,
      month: portfolio.month,
      year: portfolio.year,
      live_url: portfolio.liveUrl ?? null,
      repo_url: portfolio.repoUrl ?? null,
      cover: portfolio.cover ?? undefined,
      medias: portfolio.medias.map((media) => ({
        id: media.id,
        portfolio_id: media.portfolioId,
        path: media.path,
        caption: media.caption ?? null,
      })),
      tools: portfolio.tools.map((tool) => ({
        id: tool.id,
        portfolio_id: tool.portfolioId,
        name: tool.name,
      })),
      created_at: portfolio.createdAt?.toISOString(),
      updated_at: portfolio.updatedAt?.toISOString(),
    };
  }
}
