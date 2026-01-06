import type {
  Cv as PrismaCv,
  CvAward as PrismaCvAward,
  CvCertificate as PrismaCvCertificate,
  CvEducation as PrismaCvEducation,
  CvExperience as PrismaCvExperience,
  CvProject as PrismaCvProject,
  CvSkill as PrismaCvSkill,
  CvSocialLink as PrismaCvSocialLink,
  CvOrganization as PrismaCvOrganization,
  Prisma,
} from "../generated/prisma/client";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import createReport from "docx-templates";
import type { Cv as CvResponse, Pagination } from "../types/api-schemas";
import { prisma } from "../config/prisma.config";
import { validate } from "../utils/validate.util";
import { convertDocxToPdf } from "../utils/docx-to-pdf.util";
import env from "../config/env.config";
import dayjs from "dayjs";
import "dayjs/locale/id";
import {
  type LabelLanguage,
  DEGREE_LABELS,
  JOB_TYPE_LABELS,
  ORGANIZATION_TYPE_LABELS,
  PLATFORM_LABELS,
  PROJECT_LINK_LABELS,
  SKILL_CATEGORY_LABELS,
  SKILL_LEVEL_LABELS,
} from "../constants/cv-labels";
import {
  CvValidation,
  type CvAwardPayloadInput,
  type CvCertificatePayloadInput,
  type CvEducationPayloadInput,
  type CvExperiencePayloadInput,
  type CvListQueryInput,
  type CvOrganizationPayloadInput,
  type CvPayloadInput,
  type CvProjectPayloadInput,
  type CvSkillPayloadInput,
  type CvSocialLinkPayloadInput,
} from "../validations/cv.validation";
import { ResponseError } from "../utils/response-error.util";

type CvListResult = {
  items: CvResponse[];
  pagination: Pagination;
};

type CvWithRelations = PrismaCv & {
  template?: {
    id: string;
    name: string;
    path: string;
    type: string;
  } | null;
  educations: PrismaCvEducation[];
  certificates: PrismaCvCertificate[];
  experiences: PrismaCvExperience[];
  skills: PrismaCvSkill[];
  awards: PrismaCvAward[];
  socialLinks: PrismaCvSocialLink[];
  organizations: PrismaCvOrganization[];
  projects: PrismaCvProject[];
};

type PhotoChange = {
  path: string | null;
  created: string[];
  obsolete: string[];
};

const TEMP_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "temp");
const TEMP_PUBLIC_PREFIX = "uploads/temp";
const CV_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "cvs");
const CV_PUBLIC_PREFIX = "uploads/cvs";

const PHOTO_TARGET_WIDTH_CM = 3;

const sortFieldMap = {
  created_at: "createdAt",
  updated_at: "updatedAt",
  name: "name",
} as const satisfies Record<string, keyof Prisma.CvOrderByWithRelationInput>;

const relationInclude = {
  educations: {
    orderBy: [{ startYear: "desc" as const }, { createdAt: "desc" as const }],
  },
  certificates: {
    orderBy: [{ issueYear: "desc" as const }, { createdAt: "desc" as const }],
  },
  experiences: {
    orderBy: [{ startYear: "desc" as const }, { createdAt: "desc" as const }],
  },
  skills: {
    orderBy: [{ createdAt: "desc" as const }],
  },
  awards: {
    orderBy: [{ year: "desc" as const }, { createdAt: "desc" as const }],
  },
  socialLinks: {
    orderBy: [{ createdAt: "asc" as const }],
  },
  organizations: {
    orderBy: [{ startYear: "desc" as const }, { createdAt: "desc" as const }],
  },
  projects: {
    orderBy: [{ year: "desc" as const }, { createdAt: "desc" as const }],
  },
} satisfies Prisma.CvInclude;

export class CvService {
  static async list(userId: string, query: unknown): Promise<CvListResult> {
    const filters: CvListQueryInput = validate(CvValidation.LIST_QUERY, query);

    const where: Prisma.CvWhereInput = {
      userId,
    };

    if (filters.q) {
      const search = filters.q;
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { headline: { contains: search } },
      ];
    }

    if (filters.name) {
      where.name = { contains: filters.name };
    }

    if (filters.email) {
      where.email = { contains: filters.email };
    }

    const orderByField = sortFieldMap[filters.sort_by] ?? "createdAt";
    const orderBy: Prisma.CvOrderByWithRelationInput = {
      [orderByField]: filters.sort_order,
    };

    const page = filters.page;
    const perPage = filters.per_page;

    const [totalItems, records] = await Promise.all([
      prisma.cv.count({ where }),
      prisma.cv.findMany({
        where,
        orderBy,
        skip: (page - 1) * perPage,
        take: perPage,
        include: relationInclude,
      }),
    ]);

    const totalPages =
      totalItems === 0 ? 0 : Math.ceil(totalItems / Math.max(perPage, 1));

    return {
      items: await Promise.all(
        records.map((record) => CvService.toResponse(record))
      ),
      pagination: {
        page,
        per_page: perPage,
        total_items: totalItems,
        total_pages: totalPages,
      },
    };
  }

  static async create(userId: string, request: unknown): Promise<CvResponse> {
    const payload: CvPayloadInput = validate(CvValidation.PAYLOAD, request);
    const photoChange = await CvService.preparePhoto(userId, payload.photo);
    const now = new Date();
    const slug = await CvService.buildUniqueCvSlug(userId);
    try {
      const cv = await prisma.cv.create({
        data: {
          ...CvService.mapPayloadToData(payload, photoChange.path),
          userId,
          slug,
          createdAt: now,
          updatedAt: now,
          educations:
            payload.educations && payload.educations.length
              ? {
                  create: payload.educations.map((record) => ({
                    ...CvService.mapEducationCreate(record),
                    createdAt: now,
                    updatedAt: now,
                  })),
                }
              : undefined,
          certificates:
            payload.certificates && payload.certificates.length
              ? {
                  create: payload.certificates.map((record) => ({
                    ...CvService.mapCertificateCreate(record),
                    createdAt: now,
                    updatedAt: now,
                  })),
                }
              : undefined,
          experiences:
            payload.experiences && payload.experiences.length
              ? {
                  create: payload.experiences.map((record) => ({
                    ...CvService.mapExperienceCreate(record),
                    createdAt: now,
                    updatedAt: now,
                  })),
                }
              : undefined,
          skills:
            payload.skills && payload.skills.length
              ? {
                  create: payload.skills.map((record) => ({
                    ...CvService.mapSkillCreate(record),
                    createdAt: now,
                    updatedAt: now,
                  })),
                }
              : undefined,
          awards:
            payload.awards && payload.awards.length
              ? {
                  create: payload.awards.map((record) => ({
                    ...CvService.mapAwardCreate(record),
                    createdAt: now,
                    updatedAt: now,
                  })),
                }
              : undefined,
          socialLinks:
            payload.social_links && payload.social_links.length
              ? {
                  create: payload.social_links.map((record) => ({
                    ...CvService.mapSocialLinkCreate(record),
                    createdAt: now,
                    updatedAt: now,
                  })),
                }
              : undefined,
          organizations:
            payload.organizations && payload.organizations.length
              ? {
                  create: payload.organizations.map((record) => ({
                    ...CvService.mapOrganizationCreate(record),
                    createdAt: now,
                    updatedAt: now,
                  })),
                }
              : undefined,
          projects:
            payload.projects && payload.projects.length
              ? {
                  create: payload.projects.map((record) => ({
                    ...CvService.mapProjectCreate(record),
                    createdAt: now,
                    updatedAt: now,
                  })),
                }
              : undefined,
        },
        include: relationInclude,
      });

      return await CvService.toResponse(cv);
    } catch (error) {
      await CvService.deleteFiles(photoChange.created);
      throw error;
    }
  }

  static async get(userId: string, id: string): Promise<CvResponse> {
    const cv = await CvService.findOwnedCv(userId, id);
    return await CvService.toResponse(cv);
  }

  static async getPublicBySlug(slug: string): Promise<CvResponse> {
    const cv = await prisma.cv.findFirst({
      where: {
        slug,
        visibility: "public",
      },
      include: relationInclude,
    });

    if (!cv) {
      throw new ResponseError(404, "CV tidak ditemukan");
    }

    await prisma.cv.update({
      where: { id: cv.id },
      data: { views: { increment: 1 } },
    });

    return await CvService.toResponse({
      ...cv,
      views: cv.views + 1,
    } as CvWithRelations);
  }

  static async update(
    userId: string,
    id: string,
    request: unknown
  ): Promise<CvResponse> {
    const existing = await CvService.findOwnedCv(userId, id);
    const payload: CvPayloadInput = validate(CvValidation.PAYLOAD, request);
    let slug: string | undefined;
    if (payload.slug !== undefined) {
      const sanitized = CvService.sanitizeSlug(payload.slug);
      if (!sanitized) {
        throw new ResponseError(400, "Slug tidak valid");
      }
      const slugExists = await prisma.cv.findFirst({
        where: {
          slug: sanitized,
          NOT: { id },
        },
        select: { id: true },
      });
      if (slugExists) {
        throw new ResponseError(400, "Slug sudah digunakan");
      }
      slug = sanitized;
    }
    const photoChange = await CvService.preparePhoto(
      userId,
      payload.photo,
      existing.photo
    );
    const now = new Date();

    try {
      const cv = await prisma.$transaction(async (tx) => {
        await tx.cvEducation.deleteMany({ where: { cvId: id } });
        if (payload.educations?.length) {
          await tx.cvEducation.createMany({
            data: payload.educations.map((record) => ({
              ...CvService.mapEducationCreate(record),
              cvId: id,
              createdAt: now,
              updatedAt: now,
            })),
          });
        }

        await tx.cvCertificate.deleteMany({ where: { cvId: id } });
        if (payload.certificates?.length) {
          await tx.cvCertificate.createMany({
            data: payload.certificates.map((record) => ({
              ...CvService.mapCertificateCreate(record),
              cvId: id,
              createdAt: now,
              updatedAt: now,
            })),
          });
        }

        await tx.cvExperience.deleteMany({ where: { cvId: id } });
        if (payload.experiences?.length) {
          await tx.cvExperience.createMany({
            data: payload.experiences.map((record) => ({
              ...CvService.mapExperienceCreate(record),
              cvId: id,
              createdAt: now,
              updatedAt: now,
            })),
          });
        }

        await tx.cvSkill.deleteMany({ where: { cvId: id } });
        if (payload.skills?.length) {
          await tx.cvSkill.createMany({
            data: payload.skills.map((record) => ({
              ...CvService.mapSkillCreate(record),
              cvId: id,
              createdAt: now,
              updatedAt: now,
            })),
          });
        }

        await tx.cvAward.deleteMany({ where: { cvId: id } });
        if (payload.awards?.length) {
          await tx.cvAward.createMany({
            data: payload.awards.map((record) => ({
              ...CvService.mapAwardCreate(record),
              cvId: id,
              createdAt: now,
              updatedAt: now,
            })),
          });
        }

        await tx.cvSocialLink.deleteMany({ where: { cvId: id } });
        if (payload.social_links?.length) {
          await tx.cvSocialLink.createMany({
            data: payload.social_links.map((record) => ({
              ...CvService.mapSocialLinkCreate(record),
              cvId: id,
              createdAt: now,
              updatedAt: now,
            })),
          });
        }

        await tx.cvOrganization.deleteMany({ where: { cvId: id } });
        if (payload.organizations?.length) {
          await tx.cvOrganization.createMany({
            data: payload.organizations.map((record) => ({
              ...CvService.mapOrganizationCreate(record),
              cvId: id,
              createdAt: now,
              updatedAt: now,
            })),
          });
        }

        await tx.cvProject.deleteMany({ where: { cvId: id } });
        if (payload.projects?.length) {
          await tx.cvProject.createMany({
            data: payload.projects.map((record) => ({
              ...CvService.mapProjectCreate(record),
              cvId: id,
              createdAt: now,
              updatedAt: now,
            })),
          });
        }

        return tx.cv.update({
          where: { id },
          data: {
            ...CvService.mapPayloadToData(payload, photoChange.path),
            slug,
            updatedAt: now,
          },
          include: relationInclude,
        });
      });

      await CvService.deleteFiles(photoChange.obsolete);
      return await CvService.toResponse(cv);
    } catch (error) {
      await CvService.deleteFiles(photoChange.created);
      throw error;
    }
  }

  static async delete(userId: string, id: string): Promise<void> {
    const cv = await CvService.findOwnedCv(userId, id);
    await prisma.cv.delete({
      where: { id },
    });

    if (cv.photo) {
      await CvService.deleteFiles([cv.photo]);
    }
  }

  static async massDelete(
    userId: string,
    request: unknown
  ): Promise<{ message: string; deleted_count: number }> {
    const { ids } = validate(CvValidation.MASS_DELETE, request);

    // Verify all CVs belong to user
    const cvs = await prisma.cv.findMany({
      where: {
        id: { in: ids },
        userId,
      },
      include: relationInclude,
    });

    if (cvs.length !== ids.length) {
      throw new ResponseError(404, "Satu atau lebih CV tidak ditemukan");
    }

    // Collect all photo files to delete
    const filesToDelete: string[] = [];
    for (const cv of cvs) {
      if (cv.photo) {
        filesToDelete.push(cv.photo);
      }
    }

    // Delete CVs
    const result = await prisma.cv.deleteMany({
      where: {
        id: { in: ids },
        userId,
      },
    });

    // Delete associated files
    await CvService.deleteFiles(filesToDelete);

    return {
      message: `${result.count} CV berhasil dihapus`,
      deleted_count: result.count,
    };
  }

  static async duplicate(userId: string, id: string): Promise<CvResponse> {
    const source = await CvService.findOwnedCv(userId, id);
    const now = new Date();
    const slug = await CvService.buildUniqueCvSlug(userId);

    const duplicated = await prisma.cv.create({
      data: {
        userId,
        templateId: source.templateId ?? null,
        slug,
        visibility: source.visibility,
        views: 0,
        name: source.name,
        headline: source.headline,
        email: source.email,
        phone: source.phone,
        address: source.address,
        about: source.about,
        photo: source.photo,
        language: source.language,
        createdAt: now,
        updatedAt: now,
        educations: {
          create: source.educations.map((record) => ({
            degree: record.degree,
            schoolName: record.schoolName,
            schoolLocation: record.schoolLocation,
            major: record.major,
            startMonth: record.startMonth,
            startYear: record.startYear,
            endMonth: record.endMonth,
            endYear: record.endYear,
            isCurrent: record.isCurrent,
            gpa: record.gpa,
            description: record.description,
          })),
        },
        certificates: {
          create: source.certificates.map((record) => ({
            title: record.title,
            issuer: record.issuer,
            issueMonth: record.issueMonth,
            issueYear: record.issueYear,
            expiryMonth: record.expiryMonth,
            expiryYear: record.expiryYear,
            noExpiry: record.noExpiry,
            credentialId: record.credentialId,
            credentialUrl: record.credentialUrl,
            description: record.description,
          })),
        },
        experiences: {
          create: source.experiences.map((record) => ({
            jobTitle: record.jobTitle,
            companyName: record.companyName,
            companyLocation: record.companyLocation,
            jobType: record.jobType,
            startMonth: record.startMonth,
            startYear: record.startYear,
            endMonth: record.endMonth,
            endYear: record.endYear,
            isCurrent: record.isCurrent,
            description: record.description,
          })),
        },
        skills: {
          create: source.skills.map((record) => ({
            name: record.name,
            level: record.level,
            skillCategory: record.skillCategory,
          })),
        },
        awards: {
          create: source.awards.map((record) => ({
            title: record.title,
            issuer: record.issuer,
            description: record.description,
            year: record.year,
          })),
        },
        socialLinks: {
          create: source.socialLinks.map((record) => ({
            platform: record.platform,
            url: record.url,
          })),
        },
        organizations: {
          create: source.organizations.map((record) => ({
            organizationName: record.organizationName,
            roleTitle: record.roleTitle,
            organizationType: record.organizationType,
            location: record.location,
            startMonth: record.startMonth,
            startYear: record.startYear,
            endMonth: record.endMonth,
            endYear: record.endYear,
            isCurrent: record.isCurrent,
            description: record.description,
          })),
        },
        projects: {
          create: source.projects.map((record) => ({
            name: record.name,
            description: record.description,
            year: record.year,
            repoUrl: record.repoUrl,
            liveUrl: record.liveUrl,
          })),
        },
      },
      include: relationInclude,
    });

    return await CvService.toResponse(duplicated as CvWithRelations);
  }

  static async download(
    userId: string,
    id: string,
    format?: string
  ): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
    const normalized = (format ?? "docx").toLowerCase();
    const cv = await CvService.findOwnedCv(userId, id);
    const docxBuffer = await CvService.renderDocx(cv);
    const baseName = CvService.buildFileName(cv);

    if (normalized === "pdf") {
      if (!env.pdfDownloadEnabled) {
        throw new ResponseError(
          503,
          "Fitur unduh PDF sedang dinonaktifkan. Silakan unduh dalam format DOCX."
        );
      }
      const pdfBuffer = await convertDocxToPdf(docxBuffer, baseName);
      return {
        buffer: pdfBuffer,
        fileName: `${baseName}.pdf`,
        mimeType: "application/pdf",
      };
    }

    if (normalized !== "docx") {
      throw new ResponseError(400, "Format unduhan tidak didukung");
    }

    const fileName = `${baseName}.docx`;

    return {
      buffer: docxBuffer,
      fileName,
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
  }

  private static mapPayloadToData(
    payload: CvPayloadInput,
    photo: string | null
  ): any {
    return {
      name: payload.name,
      headline: payload.headline,
      email: payload.email,
      phone: payload.phone,
      address: payload.address,
      about: payload.about,
      photo,
      templateId: payload.template_id,
      language: payload.language,
      visibility: payload.visibility,
    };
  }

  private static async buildUniqueCvSlug(userId: string): Promise<string> {
    const user = await prisma.user.findFirst({
      where: { id: userId },
      select: { username: true },
    });

    if (!user?.username) {
      throw new ResponseError(404, "Pengguna tidak ditemukan");
    }

    const base = CvService.sanitizeSlug(
      `${user.username}-${Date.now().toString()}`
    );
    let slug = base || "cv";
    let suffix = 0;

    while (
      await prisma.cv.findFirst({
        where: { slug },
        select: { id: true },
      })
    ) {
      suffix += 1;
      slug = `${base}-${suffix}`;
    }

    return slug;
  }

  private static sanitizeSlug(value: string): string {
    const normalized = value?.trim().toLowerCase() ?? "";
    return normalized
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-");
  }

  private static mapEducationCreate(
    record: CvEducationPayloadInput
  ): Prisma.CvEducationCreateWithoutCvInput {
    return {
      degree: record.degree,
      schoolName: record.school_name,
      schoolLocation: record.school_location,
      major: record.major,
      startMonth: record.start_month,
      startYear: record.start_year,
      endMonth: record.end_month ?? null,
      endYear: record.end_year ?? null,
      isCurrent: record.is_current,
      gpa: record.gpa ?? null,
      description: record.description ?? null,
    };
  }

  private static mapCertificateCreate(
    record: CvCertificatePayloadInput
  ): Prisma.CvCertificateCreateWithoutCvInput {
    return {
      title: record.title,
      issuer: record.issuer,
      issueMonth: record.issue_month,
      issueYear: record.issue_year,
      expiryMonth: record.expiry_month ?? null,
      expiryYear: record.expiry_year ?? null,
      noExpiry: record.no_expiry ?? false,
      credentialId: record.credential_id ?? null,
      credentialUrl: record.credential_url ?? null,
      description: record.description ?? null,
    };
  }

  private static mapExperienceCreate(
    record: CvExperiencePayloadInput
  ): Prisma.CvExperienceCreateWithoutCvInput {
    return {
      jobTitle: record.job_title,
      companyName: record.company_name,
      companyLocation: record.company_location,
      jobType: record.job_type,
      startMonth: record.start_month,
      startYear: record.start_year,
      endMonth: record.end_month ?? null,
      endYear: record.end_year ?? null,
      isCurrent: record.is_current,
      description: record.description ?? null,
    };
  }

  private static mapSkillCreate(
    record: CvSkillPayloadInput
  ): Prisma.CvSkillCreateWithoutCvInput {
    return {
      name: record.name,
      level: record.level,
      skillCategory: record.skill_category,
    };
  }

  private static mapAwardCreate(
    record: CvAwardPayloadInput
  ): Prisma.CvAwardCreateWithoutCvInput {
    return {
      title: record.title,
      issuer: record.issuer,
      description: record.description ?? null,
      year: record.year,
    };
  }

  private static mapSocialLinkCreate(
    record: CvSocialLinkPayloadInput
  ): Prisma.CvSocialLinkCreateWithoutCvInput {
    return {
      platform: record.platform,
      url: record.url,
    };
  }

  private static mapOrganizationCreate(
    record: CvOrganizationPayloadInput
  ): Prisma.CvOrganizationCreateWithoutCvInput {
    return {
      organizationName: record.organization_name,
      roleTitle: record.role_title,
      organizationType: record.organization_type,
      location: record.location,
      startMonth: record.start_month,
      startYear: record.start_year,
      endMonth: record.end_month ?? null,
      endYear: record.end_year ?? null,
      isCurrent: record.is_current,
      description: record.description ?? null,
    };
  }

  private static mapProjectCreate(
    record: CvProjectPayloadInput
  ): Prisma.CvProjectCreateWithoutCvInput {
    return {
      name: record.name,
      description: record.description ?? null,
      year: record.year,
      repoUrl: record.repo_url ?? null,
      liveUrl: record.live_url ?? null,
    };
  }

  private static async findOwnedCv(
    userId: string,
    id: string
  ): Promise<CvWithRelations> {
    const cv = await prisma.cv.findFirst({
      where: {
        id,
        userId,
      },
      include: relationInclude,
    });

    if (!cv) {
      throw new ResponseError(404, "CV tidak ditemukan");
    }

    return cv;
  }

  private static async preparePhoto(
    userId: string,
    input: string | null | undefined,
    currentPhoto?: string | null
  ): Promise<PhotoChange> {
    const normalizedCurrent =
      CvService.normalizePublicPath(currentPhoto) ?? null;

    if (input === undefined) {
      return {
        path: normalizedCurrent,
        created: [],
        obsolete: [],
      };
    }

    if (input === null || !input.trim()) {
      return {
        path: null,
        created: [],
        obsolete: normalizedCurrent ? [normalizedCurrent] : [],
      };
    }

    const trimmed = input.trim();
    const normalizedInput = CvService.normalizePublicPath(trimmed);

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

    const promoted = await CvService.promoteTempFile(userId, trimmed);
    return {
      path: promoted,
      created: promoted ? [promoted] : [],
      obsolete: normalizedCurrent ? [normalizedCurrent] : [],
    };
  }

  private static async promoteTempFile(
    userId: string,
    tempPublicPath: string
  ): Promise<string> {
    const resolved = CvService.resolveUploadFile(
      tempPublicPath,
      TEMP_PUBLIC_PREFIX,
      TEMP_UPLOAD_DIR
    );

    if (!resolved) {
      throw new ResponseError(
        400,
        "Foto harus merujuk ke file sementara yang diunggah"
      );
    }

    await fs.mkdir(CV_UPLOAD_DIR, { recursive: true });

    const extension = path.extname(resolved.absolute) || ".bin";
    const fileName = CvService.buildPhotoFileName(userId, extension);
    const destination = path.join(CV_UPLOAD_DIR, fileName);

    try {
      await fs.rename(resolved.absolute, destination);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new ResponseError(400, "File foto sementara tidak ditemukan");
      }
      throw error;
    }

    return path.posix.join("/uploads/cvs", fileName);
  }

  private static buildPhotoFileName(userId: string, extension: string) {
    const normalizedExtension = extension.startsWith(".")
      ? extension
      : `.${extension}`;
    const safeUser = userId.replace(/[^a-zA-Z0-9]/g, "").slice(-12) || "user";
    return `${Date.now()}-${safeUser}-${crypto.randomUUID()}${normalizedExtension}`;
  }

  private static normalizePublicPath(value?: string | null): string | null {
    const resolved = CvService.resolveUploadFile(
      value,
      CV_PUBLIC_PREFIX,
      CV_UPLOAD_DIR
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

  private static async deleteFiles(paths: (string | null | undefined)[]) {
    const unique = Array.from(
      new Set(
        paths
          .filter((value): value is string => Boolean(value))
          .map((value) => value!)
      )
    );

    await Promise.all(
      unique.map(async (publicPath) => {
        const resolved = CvService.resolveUploadFile(
          publicPath,
          CV_PUBLIC_PREFIX,
          CV_UPLOAD_DIR
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
      })
    );
  }
  private static async renderDocx(cv: CvWithRelations): Promise<Buffer> {
    // Template is now required, no fallback to default templates
    if (!cv.templateId) {
      throw new ResponseError(400, "Template diperlukan");
    }

    const template = await (prisma as any).template.findUnique({
      where: { id: cv.templateId },
    });

    if (!template) {
      throw new ResponseError(404, "Template tidak ditemukan");
    }

    const templatePath = path.join(process.cwd(), "public", template.path);
    const templateBinary = await fs.readFile(templatePath);
    const context = CvService.buildTemplateContext(cv);
    console.log(context);
    const additionalJsContext = cv.photo
      ? CvService.buildAdditionalJsContext()
      : undefined;

    const rendered = await createReport({
      template: templateBinary,
      data: context,
      cmdDelimiter: ["{{", "}}"],
      additionalJsContext,
    });

    return Buffer.isBuffer(rendered)
      ? rendered
      : Buffer.from(rendered as Uint8Array);
  }

  private static buildTemplateContext(cv: CvWithRelations) {
    const language = CvService.normalizeLanguage(cv.language);

    return {
      name: cv.name.toUpperCase(),
      headline: cv.headline,
      email: {
        url: `mailto:${cv.email}`,
        label: cv.email,
      },
      phone: cv.phone,
      address: cv.address,
      about: cv.about,
      photo_path: cv.photo ?? "",
      educations: cv.educations.map((record) => ({
        degree: CvService.getDegreeLabel(record.degree, language),
        school_name: record.schoolName,
        school_location: record.schoolLocation,
        major: record.major,
        start_month: CvService.formatMonth(record.startMonth, language),
        start_year: record.startYear,
        end_month: CvService.formatMonth(record.endMonth, language),
        end_year: record.endYear,
        is_current: record.isCurrent,
        gpa: record.gpa,
        description: record.description,
      })),
      certificates: cv.certificates.map((record) => ({
        title: record.title,
        issuer: record.issuer,
        issue_month: CvService.formatMonth(record.issueMonth, language),
        issue_year: record.issueYear,
        expiry_month: CvService.formatMonth(record.expiryMonth, language),
        expiry_year: record.expiryYear,
        no_expiry: record.noExpiry,
        credential_id: record.credentialId,
        credential_url: record.credentialUrl,
        description: record.description,
      })),
      experiences: cv.experiences.map((record) => ({
        job_title: record.jobTitle,
        company_name: record.companyName,
        company_location: record.companyLocation,
        job_type: CvService.getJobTypeLabel(record.jobType, language),
        start_month: CvService.formatMonth(record.startMonth, language),
        start_year: record.startYear,
        end_month: CvService.formatMonth(record.endMonth, language),
        end_year: record.endYear,
        is_current: record.isCurrent,
        description: record.description,
        description_points: CvService.splitDescriptionLines(record.description),
      })),
      skills: cv.skills.map((record) => ({
        name: record.name,
        level: CvService.getSkillLevelLabel(record.level, language),
        category: CvService.getSkillCategoryLabel(
          record.skillCategory,
          language
        ),
      })),
      skills_by_category: CvService.groupSkillsByCategory(cv.skills, language),
      awards: cv.awards.map((record) => ({
        title: record.title,
        issuer: record.issuer,
        description: record.description,
        year: record.year,
      })),
      social_links: cv.socialLinks.map((record) => ({
        platform: CvService.getPlatformLabel(record.platform, language),
        url: record.url,
        label: CvService.getPlatformLabel(record.platform, language),
      })),
      organizations: cv.organizations.map((record) => ({
        organization_name: record.organizationName,
        role_title: record.roleTitle,
        organization_type: CvService.getOrganizationTypeLabel(
          record.organizationType,
          language
        ),
        location: record.location,
        start_month: CvService.formatMonth(record.startMonth, language),
        start_year: record.startYear,
        end_month: CvService.formatMonth(record.endMonth, language),
        end_year: record.endYear,
        is_current: record.isCurrent,
        description: record.description,
        description_points: CvService.splitDescriptionLines(record.description),
      })),
      projects: cv.projects.map((record) => {
        const repoLabel = record.repoUrl
          ? CvService.getProjectLinkLabel("repo", language)
          : "";
        const liveLabel = record.liveUrl
          ? CvService.getProjectLinkLabel("live", language)
          : "";

        return {
          name: record.name,
          description: record.description,
          year: record.year,
          repo_url: record.repoUrl,
          repo_label: repoLabel,
          live_url: record.liveUrl,
          live_label: liveLabel,
          description_points: CvService.splitDescriptionLines(
            record.description
          ),
        };
      }),
    };
  }

  private static splitDescriptionLines(value?: string | null): string[] {
    if (!value) {
      return [];
    }

    return value
      .split(/\r?\n/)
      .map((segment) => segment.trim())
      .filter(Boolean);
  }

  private static buildSocialLinkLabel(url: string): string {
    const trimmed = url?.trim() ?? "";
    if (!trimmed) {
      return "";
    }

    const withoutProtocol = trimmed.replace(/^\s*https?:\/\//i, "");
    return withoutProtocol.replace(/\/+$/, "");
  }

  private static buildAdditionalJsContext() {
    return {
      photoImage: async (photoPath?: string | null) =>
        CvService.createPhotoImage(photoPath),
    };
  }

  private static formatMonth(
    value?: number | null,
    language: LabelLanguage = "id"
  ): string {
    if (!value || value < 1 || value > 12) {
      return "";
    }
    return dayjs()
      .set("date", 1)
      .set("month", value - 1)
      .locale(language === "en" ? "en" : "id")
      .format("MMM");
  }

  private static normalizeLanguage(value?: string | null): LabelLanguage {
    return value === "en" ? "en" : "id";
  }

  private static getDegreeLabel(
    value?: string | null,
    language: LabelLanguage = "id"
  ): string {
    return CvService.getEnumLabel(value, DEGREE_LABELS, language);
  }

  private static getJobTypeLabel(
    value?: string | null,
    language: LabelLanguage = "id"
  ): string {
    return CvService.getEnumLabel(value, JOB_TYPE_LABELS, language);
  }

  private static getSkillLevelLabel(
    value?: string | null,
    language: LabelLanguage = "id"
  ): string {
    return CvService.getEnumLabel(value, SKILL_LEVEL_LABELS, language);
  }

  private static getSkillCategoryLabel(
    value?: string | null,
    language: LabelLanguage = "id"
  ): string {
    return CvService.getEnumLabel(value, SKILL_CATEGORY_LABELS, language);
  }

  private static getOrganizationTypeLabel(
    value?: string | null,
    language: LabelLanguage = "id"
  ): string {
    return CvService.getEnumLabel(value, ORGANIZATION_TYPE_LABELS, language);
  }

  private static getPlatformLabel(
    value?: string | null,
    language: LabelLanguage = "id"
  ): string {
    return CvService.getEnumLabel(value, PLATFORM_LABELS, language);
  }

  private static getProjectLinkLabel(
    value: "repo" | "live",
    language: LabelLanguage = "id"
  ): string {
    return PROJECT_LINK_LABELS[language]?.[value] ?? value;
  }

  private static groupSkillsByCategory(
    skills: PrismaCvSkill[],
    language: LabelLanguage
  ): { label: string; skills: string[] }[] {
    const grouped = new Map<string, string[]>();

    for (const skill of skills) {
      const label = CvService.getSkillCategoryLabel(
        skill.skillCategory,
        language
      );
      const bucket = grouped.get(label);
      if (bucket) {
        bucket.push(skill.name);
      } else {
        grouped.set(label, [skill.name]);
      }
    }

    return Array.from(grouped.entries()).map(([label, entries]) => ({
      label,
      skills: entries,
    }));
  }

  private static getEnumLabel(
    value: string | null | undefined,
    labels: Record<LabelLanguage, Record<string, string>>,
    language: LabelLanguage
  ): string {
    if (!value) {
      return "";
    }

    return (
      labels[language]?.[value] ??
      labels.en?.[value] ??
      CvService.toTitleCase(value)
    );
  }

  private static toTitleCase(value: string): string {
    return value
      .split("_")
      .filter(Boolean)
      .map((part) => part[0].toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
  }

  private static async createPhotoImage(photoPath?: string | null): Promise<{
    width: number;
    height: number;
    data: Buffer;
    extension: ".png" | ".jpg";
  } | null> {
    const resolved = CvService.resolveUploadFile(
      photoPath ?? "",
      CV_PUBLIC_PREFIX,
      CV_UPLOAD_DIR
    );

    if (!resolved) {
      return null;
    }

    const extension = CvService.getImageExtension(resolved.absolute);
    if (!extension) {
      return null;
    }

    try {
      const buffer = await fs.readFile(resolved.absolute);
      const dimensions = CvService.extractImageDimensions(buffer, extension);
      const aspectRatio =
        dimensions && dimensions.width > 0
          ? dimensions.width / Math.max(dimensions.height, 0.1)
          : 1;
      const width = PHOTO_TARGET_WIDTH_CM;
      const height = width / Math.max(aspectRatio, 0.1);

      return {
        width: Number(width.toFixed(2)),
        height: Number(height.toFixed(2)),
        data: buffer,
        extension,
      };
    } catch {
      return null;
    }
  }

  private static getImageExtension(filePath: string): ".png" | ".jpg" | null {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === ".png") {
      return ".png";
    }
    if (ext === ".jpg" || ext === ".jpeg") {
      return ".jpg";
    }
    return null;
  }

  private static extractImageDimensions(
    buffer: Buffer,
    extension: ".png" | ".jpg"
  ): { width: number; height: number } | null {
    if (extension === ".png") {
      return CvService.extractPngDimensions(buffer);
    }

    return CvService.extractJpegDimensions(buffer);
  }

  private static extractPngDimensions(
    buffer: Buffer
  ): { width: number; height: number } | null {
    if (buffer.length < 24) {
      return null;
    }

    const pngSignature = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    if (!buffer.subarray(0, 8).equals(pngSignature)) {
      return null;
    }

    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return { width, height };
  }

  private static extractJpegDimensions(
    buffer: Buffer
  ): { width: number; height: number } | null {
    if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
      return null;
    }

    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }

      const marker = buffer[offset + 1];
      offset += 2;

      if (marker === 0xd9 || marker === 0xda) {
        break;
      }

      if (offset + 1 >= buffer.length) {
        break;
      }

      const segmentLength = buffer.readUInt16BE(offset);
      if (segmentLength < 2 || offset + segmentLength > buffer.length) {
        break;
      }

      if (CvService.isJpegSofMarker(marker)) {
        if (offset + 5 >= buffer.length) {
          break;
        }
        const height = buffer.readUInt16BE(offset + 3);
        const width = buffer.readUInt16BE(offset + 5);
        return { width, height };
      }

      offset += segmentLength;
    }

    return null;
  }

  private static isJpegSofMarker(marker: number): boolean {
    return (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    );
  }

  private static buildFileName(cv: PrismaCv): string {
    const raw = `${cv.name ?? "CV"} - ${cv.headline ?? "Profile"}`;
    const sanitized = raw
      .replace(/[<>:"/\\|?*]+/g, "")
      .replace(/[\s-]+/g, "_")
      .trim()
      .slice(0, 120);

    return sanitized || "curriculum-vitae";
  }

  private static async toResponse(cv: CvWithRelations): Promise<CvResponse> {
    // Fetch template data if templateId exists
    let template = null;
    if (cv.templateId) {
      template = await (prisma as any).template.findUnique({
        where: { id: cv.templateId },
        select: {
          id: true,
          name: true,
          path: true,
          type: true,
        },
      });
    }

    return {
      id: cv.id,
      user_id: cv.userId,
      slug: cv.slug,
      name: cv.name,
      headline: cv.headline,
      email: cv.email,
      phone: cv.phone,
      address: cv.address,
      about: cv.about,
      photo: cv.photo ?? null,
      visibility: cv.visibility,
      views: cv.views,
      template_id: cv.templateId ?? null,
      language: cv.language,
      template: template
        ? {
            id: template.id,
            name: template.name,
            path: template.path,
            type: template.type,
          }
        : null,
      created_at: cv.createdAt?.toISOString(),
      updated_at: cv.updatedAt?.toISOString(),
      educations: cv.educations.map((record) => ({
        id: record.id,
        cv_id: record.cvId,
        degree: record.degree,
        school_name: record.schoolName,
        school_location: record.schoolLocation,
        major: record.major,
        start_month: record.startMonth,
        start_year: record.startYear,
        end_month: record.endMonth ?? null,
        end_year: record.endYear ?? null,
        is_current: record.isCurrent,
        gpa: record.gpa ?? null,
        description: record.description ?? null,
      })),
      certificates: cv.certificates.map((record) => ({
        id: record.id,
        cv_id: record.cvId,
        title: record.title,
        issuer: record.issuer,
        issue_month: record.issueMonth,
        issue_year: record.issueYear,
        expiry_month: record.expiryMonth ?? null,
        expiry_year: record.expiryYear ?? null,
        no_expiry: record.noExpiry,
        credential_id: record.credentialId ?? null,
        credential_url: record.credentialUrl ?? null,
        description: record.description ?? null,
      })),
      experiences: cv.experiences.map((record) => ({
        id: record.id,
        cv_id: record.cvId,
        job_title: record.jobTitle,
        company_name: record.companyName,
        company_location: record.companyLocation,
        job_type: record.jobType,
        start_month: record.startMonth,
        start_year: record.startYear,
        end_month: record.endMonth ?? null,
        end_year: record.endYear ?? null,
        is_current: record.isCurrent,
        description: record.description ?? null,
      })),
      skills: cv.skills.map((record) => ({
        id: record.id,
        cv_id: record.cvId,
        name: record.name,
        level: record.level,
        skill_category: record.skillCategory,
      })),
      awards: cv.awards.map((record) => ({
        id: record.id,
        cv_id: record.cvId,
        title: record.title,
        issuer: record.issuer,
        description: record.description ?? null,
        year: record.year,
      })),
      social_links: cv.socialLinks.map((record) => ({
        id: record.id,
        cv_id: record.cvId,
        platform: record.platform,
        url: record.url,
      })),
      organizations: cv.organizations.map((record) => ({
        id: record.id,
        cv_id: record.cvId,
        organization_name: record.organizationName,
        role_title: record.roleTitle,
        organization_type: record.organizationType,
        location: record.location,
        start_month: record.startMonth,
        start_year: record.startYear,
        end_month: record.endMonth ?? null,
        end_year: record.endYear ?? null,
        is_current: record.isCurrent,
        description: record.description ?? null,
      })),
      projects: cv.projects.map((record) => ({
        id: record.id,
        cv_id: record.cvId,
        name: record.name,
        description: record.description ?? null,
        year: record.year,
        repo_url: record.repoUrl ?? null,
        live_url: record.liveUrl ?? null,
      })),
    };
  }
}
