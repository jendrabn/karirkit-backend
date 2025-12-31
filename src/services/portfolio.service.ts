import type {
  Portfolio as PrismaPortfolio,
  PortfolioMedia as PrismaPortfolioMedia,
  PortfolioTool as PrismaPortfolioTool,
  Prisma,
} from "../generated/prisma/client";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import type {
  Pagination,
  Portfolio as PortfolioSchema,
} from "../types/api-schemas";
import { prisma } from "../config/prisma.config";
import { validate } from "../utils/validate.util";
import {
  PortfolioValidation,
  type PortfolioListQuery,
  type PortfolioMediaPayloadInput,
  type PortfolioPayloadInput,
} from "../validations/portfolio.validation";
import { ResponseError } from "../utils/response-error.util";
import { slugify } from "../utils/slugify.util";

type PortfolioListResult = {
  items: PortfolioSchema[];
  pagination: Pagination;
};

type PortfolioMutableFields = Omit<
  Prisma.PortfolioUncheckedCreateInput,
  "id" | "userId" | "createdAt" | "updatedAt" | "slug"
>;

type PreparedMediaRecord = {
  path: string;
  caption: string | null;
};

type CoverChange = {
  path: string;
  created: string[];
  obsolete: string[];
};

type MediaChange = {
  medias: PreparedMediaRecord[];
  created: string[];
  obsolete: string[];
};

const TEMP_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "temp");
const TEMP_PUBLIC_PREFIX = "uploads/temp";
const PORTFOLIO_UPLOAD_DIR = path.join(
  process.cwd(),
  "public",
  "uploads",
  "portfolios"
);
const PORTFOLIO_PUBLIC_PREFIX = "uploads/portfolios";
const DEFAULT_EXTENSION = ".bin";

const sortFieldMap = {
  created_at: "createdAt",
  updated_at: "updatedAt",
  year: "year",
  month: "month",
  title: "title",
} as const satisfies Record<
  string,
  keyof Prisma.PortfolioOrderByWithRelationInput
>;

const portfolioInclude = {
  medias: {
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
  },
  tools: {
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
  },
} satisfies Prisma.PortfolioInclude;

export class PortfolioService {
  static async list(
    userId: string,
    query: unknown
  ): Promise<PortfolioListResult> {
    const filters: PortfolioListQuery = validate(
      PortfolioValidation.LIST_QUERY,
      query
    );
    const where: Prisma.PortfolioWhereInput = {
      userId,
    };

    if (filters.q) {
      const search = filters.q;
      where.OR = [
        { title: { contains: search } },
        { slug: { contains: search } },
        { roleTitle: { contains: search } },
        { industry: { contains: search } },
        { description: { contains: search } },
      ];
    }

    if (filters.project_type) {
      where.projectType = filters.project_type;
    }

    if (filters.industry) {
      where.industry = { contains: filters.industry };
    }

    if (filters.year) {
      where.year = filters.year;
    }

    if (filters.month) {
      where.month = filters.month;
    }

    const orderByField = sortFieldMap[filters.sort_by] ?? "createdAt";
    const orderBy: Prisma.PortfolioOrderByWithRelationInput = {
      [orderByField]: filters.sort_order,
    };

    const page = filters.page;
    const perPage = filters.per_page;

    const [totalItems, records] = await Promise.all([
      prisma.portfolio.count({ where }),
      prisma.portfolio.findMany({
        where,
        orderBy,
        skip: (page - 1) * perPage,
        take: perPage,
        include: portfolioInclude,
      }),
    ]);

    const totalPages =
      totalItems === 0 ? 0 : Math.ceil(totalItems / Math.max(perPage, 1));

    return {
      items: records.map((record) => PortfolioService.toResponse(record)),
      pagination: {
        page,
        per_page: perPage,
        total_items: totalItems,
        total_pages: totalPages,
      },
    };
  }

  static async create(
    userId: string,
    request: unknown
  ): Promise<PortfolioSchema> {
    const payload: PortfolioPayloadInput = validate(
      PortfolioValidation.PAYLOAD,
      request
    );

    const coverChange = await PortfolioService.prepareCoverValue(
      userId,
      payload.cover
    );
    const mediaChange = await PortfolioService.prepareMediaFiles(
      userId,
      payload.medias ?? []
    );
    const toolValues = PortfolioService.prepareTools(payload.tools ?? []);
    const now = new Date();
    const slug = slugify(payload.title, 10);

    try {
      const portfolio = await prisma.portfolio.create({
        data: {
          ...PortfolioService.mapPayloadToData(payload, coverChange.path),
          slug,
          userId,
          createdAt: now,
          updatedAt: now,
          medias: mediaChange.medias.length
            ? {
                create: mediaChange.medias.map((media) => ({
                  path: media.path,
                  caption: media.caption,
                  createdAt: now,
                  updatedAt: now,
                })),
              }
            : undefined,
          tools: toolValues.length
            ? {
                create: toolValues.map((name) => ({
                  name,
                  createdAt: now,
                  updatedAt: now,
                })),
              }
            : undefined,
        },
        include: portfolioInclude,
      });

      return PortfolioService.toResponse(portfolio);
    } catch (error) {
      await PortfolioService.deletePortfolioFiles([
        ...coverChange.created,
        ...mediaChange.created,
      ]);
      throw error;
    }
  }

  static async get(userId: string, id: string): Promise<PortfolioSchema> {
    const portfolio = await PortfolioService.findOwnedPortfolio(userId, id);
    return PortfolioService.toResponse(portfolio);
  }

  static async update(
    userId: string,
    id: string,
    request: unknown
  ): Promise<PortfolioSchema> {
    const existing = await PortfolioService.findOwnedPortfolio(userId, id);
    const payload: PortfolioPayloadInput = validate(
      PortfolioValidation.PAYLOAD,
      request
    );
    const coverChange = await PortfolioService.prepareCoverValue(
      userId,
      payload.cover,
      existing.cover
    );
    const shouldUpdateMedias = payload.medias !== undefined;
    const mediaChange = shouldUpdateMedias
      ? await PortfolioService.prepareMediaFiles(
          userId,
          payload.medias!,
          existing.medias
        )
      : null;
    const shouldUpdateTools = payload.tools !== undefined;
    const toolValues = shouldUpdateTools
      ? PortfolioService.prepareTools(payload.tools!)
      : null;
    const now = new Date();

    try {
      const portfolio = await prisma.$transaction(async (tx) => {
        if (mediaChange) {
          await tx.portfolioMedia.deleteMany({
            where: { portfolioId: id },
          });

          if (mediaChange.medias.length) {
            await tx.portfolioMedia.createMany({
              data: mediaChange.medias.map((media) => ({
                portfolioId: id,
                path: media.path,
                caption: media.caption,
                createdAt: now,
                updatedAt: now,
              })),
            });
          }
        }

        if (toolValues) {
          await tx.portfolioTool.deleteMany({
            where: { portfolioId: id },
          });

          if (toolValues.length) {
            await tx.portfolioTool.createMany({
              data: toolValues.map((name) => ({
                portfolioId: id,
                name,
                createdAt: now,
                updatedAt: now,
              })),
            });
          }
        }

        const updateData: any = {
          ...PortfolioService.mapPayloadToData(payload, coverChange.path),
          updatedAt: now,
        };

        if (payload.title) {
          updateData.slug = slugify(payload.title, 10);
        }

        const updated = await tx.portfolio.update({
          where: { id },
          data: updateData,
          include: portfolioInclude,
        });

        return updated;
      });

      if (mediaChange) {
        await PortfolioService.deletePortfolioFiles(mediaChange.obsolete);
      }
      await PortfolioService.deletePortfolioFiles(coverChange.obsolete);

      return PortfolioService.toResponse(portfolio);
    } catch (error) {
      const cleanupTargets = [
        ...coverChange.created,
        ...(mediaChange?.created ?? []),
      ];
      await PortfolioService.deletePortfolioFiles(cleanupTargets);
      throw error;
    }
  }

  static async delete(userId: string, id: string): Promise<void> {
    const existing = await PortfolioService.findOwnedPortfolio(userId, id);
    await prisma.portfolio.delete({
      where: { id },
    });

    const filesToDelete = [
      PortfolioService.normalizePortfolioPublicPath(existing.cover),
      ...existing.medias.map((media) =>
        PortfolioService.normalizePortfolioPublicPath(media.path)
      ),
    ].filter((value): value is string => Boolean(value));

    await PortfolioService.deletePortfolioFiles(filesToDelete);
  }

  static async massDelete(
    userId: string,
    request: unknown
  ): Promise<{ message: string; deleted_count: number }> {
    const { ids } = validate(PortfolioValidation.MASS_DELETE, request);

    // Verify all portfolios belong to the user
    const portfolios = await prisma.portfolio.findMany({
      where: {
        id: { in: ids },
        userId,
      },
      include: portfolioInclude,
    });

    if (portfolios.length !== ids.length) {
      throw new ResponseError(404, "Satu atau lebih portfolio tidak ditemukan");
    }

    // Collect all files to delete
    const filesToDelete: string[] = [];
    for (const portfolio of portfolios) {
      const coverPath = PortfolioService.normalizePortfolioPublicPath(
        portfolio.cover
      );
      if (coverPath) {
        filesToDelete.push(coverPath);
      }

      for (const media of portfolio.medias) {
        const mediaPath = PortfolioService.normalizePortfolioPublicPath(
          media.path
        );
        if (mediaPath) {
          filesToDelete.push(mediaPath);
        }
      }
    }

    // Delete portfolios
    const result = await prisma.portfolio.deleteMany({
      where: {
        id: { in: ids },
        userId,
      },
    });

    // Delete associated files
    await PortfolioService.deletePortfolioFiles(filesToDelete);

    return {
      message: `${result.count} portfolio berhasil dihapus`,
      deleted_count: result.count,
    };
  }

  private static async findOwnedPortfolio(
    userId: string,
    id: string
  ): Promise<
    PrismaPortfolio & {
      medias: PrismaPortfolioMedia[];
      tools: PrismaPortfolioTool[];
    }
  > {
    const portfolio = await prisma.portfolio.findFirst({
      where: {
        id,
        userId,
      },
      include: portfolioInclude,
    });

    if (!portfolio) {
      throw new ResponseError(404, "Portfolio tidak ditemukan");
    }

    return portfolio;
  }

  private static mapPayloadToData(
    payload: PortfolioPayloadInput,
    coverPath: string
  ): PortfolioMutableFields {
    return {
      title: payload.title,
      // slug removed
      sortDescription: payload.sort_description,
      description: payload.description,
      roleTitle: payload.role_title,
      projectType: payload.project_type,
      industry: payload.industry,
      month: payload.month,
      year: payload.year,
      liveUrl: payload.live_url ?? null,
      repoUrl: payload.repo_url ?? null,
      cover: coverPath,
    };
  }

  private static async prepareCoverValue(
    userId: string,
    coverInput: string | null | undefined,
    currentCover?: string | null
  ): Promise<CoverChange> {
    const normalizedCurrent =
      PortfolioService.normalizePortfolioPublicPath(currentCover);
    const existingValue = normalizedCurrent ?? currentCover?.trim() ?? "";

    if (coverInput === undefined) {
      return {
        path: existingValue,
        created: [],
        obsolete: [],
      };
    }

    if (coverInput === null) {
      return {
        path: "",
        created: [],
        obsolete: normalizedCurrent ? [normalizedCurrent] : [],
      };
    }

    const trimmed = coverInput.trim();
    if (!trimmed) {
      return {
        path: "",
        created: [],
        obsolete: normalizedCurrent ? [normalizedCurrent] : [],
      };
    }

    const normalizedInput =
      PortfolioService.normalizePortfolioPublicPath(trimmed);
    if (normalizedInput) {
      return {
        path: normalizedInput,
        created: [],
        obsolete:
          normalizedCurrent && normalizedCurrent !== normalizedInput
            ? [normalizedCurrent]
            : [],
      };
    }

    const promoted = await PortfolioService.promoteTempFile(userId, trimmed);
    return {
      path: promoted,
      created: [promoted],
      obsolete: normalizedCurrent ? [normalizedCurrent] : [],
    };
  }

  private static async prepareMediaFiles(
    userId: string,
    entries: PortfolioMediaPayloadInput[],
    existing: PrismaPortfolioMedia[] = []
  ): Promise<MediaChange> {
    const medias: PreparedMediaRecord[] = [];
    const created: string[] = [];
    const retained = new Set<string>();

    const existingPaths = new Set<string>();
    for (const media of existing) {
      const normalized = PortfolioService.normalizePortfolioPublicPath(
        media.path
      );
      if (normalized) {
        existingPaths.add(normalized);
      }
    }

    for (const entry of entries) {
      const trimmedPath = entry.path.trim();
      const normalizedFinal =
        PortfolioService.normalizePortfolioPublicPath(trimmedPath);

      if (normalizedFinal) {
        medias.push({
          path: normalizedFinal,
          caption: PortfolioService.normalizeCaption(entry.caption),
        });
        retained.add(normalizedFinal);
        continue;
      }

      const promoted = await PortfolioService.promoteTempFile(
        userId,
        trimmedPath
      );
      medias.push({
        path: promoted,
        caption: PortfolioService.normalizeCaption(entry.caption),
      });
      retained.add(promoted);
      created.push(promoted);
    }

    const obsolete: string[] = [];
    for (const previous of existingPaths) {
      if (!retained.has(previous)) {
        obsolete.push(previous);
      }
    }

    return {
      medias,
      created,
      obsolete,
    };
  }

  private static normalizeCaption(caption?: string | null): string | null {
    if (caption === null || caption === undefined) {
      return null;
    }
    const trimmed = caption.trim();
    return trimmed || null;
  }

  private static prepareTools(tools: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const tool of tools) {
      const trimmed = tool.trim();
      if (!trimmed) {
        continue;
      }
      const key = trimmed.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      result.push(trimmed);
    }

    return result;
  }

  private static async promoteTempFile(
    userId: string,
    tempPublicPath: string
  ): Promise<string> {
    const resolved = PortfolioService.resolveUploadFile(
      tempPublicPath,
      TEMP_PUBLIC_PREFIX,
      TEMP_UPLOAD_DIR
    );

    if (!resolved) {
      throw new ResponseError(
        400,
        "File harus merujuk ke file sementara yang diunggah"
      );
    }

    await fs.mkdir(PORTFOLIO_UPLOAD_DIR, { recursive: true });

    const extension = PortfolioService.extractExtension(resolved.absolute);
    const fileName = PortfolioService.buildPortfolioFileName(userId, extension);
    const destination = path.join(PORTFOLIO_UPLOAD_DIR, fileName);

    try {
      await fs.rename(resolved.absolute, destination);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new ResponseError(400, "File sementara tidak ditemukan");
      }
      throw error;
    }

    return path.posix.join("/uploads/portfolios", fileName);
  }

  private static extractExtension(filePath: string): string {
    const ext = path.extname(filePath);
    if (!ext) {
      return DEFAULT_EXTENSION;
    }
    return ext;
  }

  private static buildPortfolioFileName(
    userId: string,
    extension: string
  ): string {
    const safeUser = userId.replace(/[^a-zA-Z0-9]/g, "").slice(-12) || "user";
    const normalizedExtension = extension.startsWith(".")
      ? extension
      : `.${extension}`;
    return `${Date.now()}-${safeUser}-${crypto.randomUUID()}${normalizedExtension}`;
  }

  private static normalizePortfolioPublicPath(
    value?: string | null
  ): string | null {
    const resolved = PortfolioService.resolveUploadFile(
      value,
      PORTFOLIO_PUBLIC_PREFIX,
      PORTFOLIO_UPLOAD_DIR
    );

    return resolved?.publicPath ?? null;
  }

  private static resolveUploadFile(
    input: string | null | undefined,
    prefix: string,
    directory: string
  ): { absolute: string; relative: string; publicPath: string } | null {
    if (!input) {
      return null;
    }

    const trimmed = input.trim();
    if (!trimmed) {
      return null;
    }

    const normalizedPrefix = prefix
      .replace(/\\/g, "/")
      .replace(/^\/+/, "")
      .replace(/\/+$/, "");
    const normalizedInput = trimmed.replace(/\\/g, "/").replace(/^\/+/, "");
    const lowerInput = normalizedInput.toLowerCase();
    const lowerPrefix = `${normalizedPrefix.toLowerCase()}/`;

    if (!lowerInput.startsWith(lowerPrefix)) {
      return null;
    }

    const relativeRaw = normalizedInput.slice(lowerPrefix.length);
    if (!relativeRaw) {
      return null;
    }

    const safeRelative = path.normalize(relativeRaw);
    if (safeRelative.startsWith("..") || path.isAbsolute(safeRelative)) {
      return null;
    }

    const posixRelative = safeRelative.replace(/\\/g, "/");

    return {
      absolute: path.join(directory, safeRelative),
      relative: posixRelative,
      publicPath: path.posix.join("/", normalizedPrefix, posixRelative),
    };
  }

  private static async deletePortfolioFiles(paths: string[]): Promise<void> {
    if (!paths.length) {
      return;
    }

    const unique = Array.from(new Set(paths));
    await Promise.all(
      unique.map((publicPath) =>
        PortfolioService.deletePortfolioFile(publicPath)
      )
    );
  }

  private static async deletePortfolioFile(publicPath: string): Promise<void> {
    const resolved = PortfolioService.resolveUploadFile(
      publicPath,
      PORTFOLIO_PUBLIC_PREFIX,
      PORTFOLIO_UPLOAD_DIR
    );

    if (!resolved) {
      return;
    }

    try {
      await fs.unlink(resolved.absolute);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  private static toResponse(
    portfolio: PrismaPortfolio & {
      medias: PrismaPortfolioMedia[];
      tools: PrismaPortfolioTool[];
    }
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
