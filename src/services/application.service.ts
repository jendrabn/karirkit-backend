import type {
  Application as PrismaApplication,
  Prisma,
} from "../generated/prisma/client";
import type {
  Application as ApplicationResponse,
  Pagination,
} from "../types/api-schemas";
import { prisma } from "../config/prisma.config";
import { validate } from "../utils/validate.util";
import {
  ApplicationValidation,
  type ApplicationListQuery,
  type ApplicationPayloadInput,
  type MassDeleteInput,
} from "../validations/application.validation";
import { ResponseError } from "../utils/response-error.util";

type ApplicationListResult = {
  items: ApplicationResponse[];
  pagination: Pagination;
};

type ApplicationMutableFields = Omit<
  Prisma.ApplicationUncheckedCreateInput,
  "id" | "userId" | "createdAt" | "updatedAt"
>;

const sortFieldMap = {
  date: "date",
  created_at: "createdAt",
  updated_at: "updatedAt",
  company_name: "companyName",
  position: "position",
  follow_up_date: "followUpDate",
  salary_max: "salaryMax",
} as const;

export class ApplicationService {
  private static normalizeWhereAnd(
    value: Prisma.ApplicationWhereInput["AND"]
  ): Prisma.ApplicationWhereInput[] {
    if (!value) {
      return [];
    }
    return Array.isArray(value) ? value : [value];
  }

  static async list(
    userId: string,
    query: unknown
  ): Promise<ApplicationListResult> {
    const filters: ApplicationListQuery = validate(
      ApplicationValidation.LIST_QUERY,
      query
    );
    const page = filters.page;
    const perPage = filters.per_page;

    const where: Prisma.ApplicationWhereInput = {
      userId,
    };

    if (filters.q) {
      const search = filters.q;
      where.OR = [
        { companyName: { contains: search } },
        { position: { contains: search } },
        { jobSource: { contains: search } },
        { location: { contains: search } },
        { contactName: { contains: search } },
        { contactEmail: { contains: search } },
        { contactPhone: { contains: search } },
        { notes: { contains: search } },
        { followUpNote: { contains: search } },
      ];
    }

    if (filters.status?.length) {
      where.status = { in: filters.status };
    }

    if (filters.result_status?.length) {
      where.resultStatus = { in: filters.result_status };
    }

    if (filters.job_type?.length) {
      where.jobType = { in: filters.job_type };
    }

    if (filters.work_system?.length) {
      where.workSystem = { in: filters.work_system };
    }

    if (filters.location?.length) {
      where.location = { in: filters.location };
    }

    if (filters.company_name) {
      where.companyName = filters.company_name;
    }

    if (filters.job_source?.length) {
      where.jobSource = { in: filters.job_source };
    }

    if (filters.date_from || filters.date_to) {
      where.date = {};

      if (filters.date_from) {
        where.date.gte = ApplicationService.parseDateOnly(filters.date_from);
      }

      if (filters.date_to) {
        where.date.lte = ApplicationService.parseDateOnly(filters.date_to);
      }
    }

    if (
      filters.follow_up_date_from ||
      filters.follow_up_date_to ||
      filters.follow_up_date_has !== undefined ||
      filters.follow_up_overdue !== undefined
    ) {
      const followUpConditions: Prisma.ApplicationWhereInput[] = [];

      if (filters.follow_up_date_has === true) {
        followUpConditions.push({ followUpDate: { not: null } });
      }

      if (filters.follow_up_date_has === false) {
        followUpConditions.push({ followUpDate: null });
      }

      if (filters.follow_up_date_from || filters.follow_up_date_to) {
        const followUpRange: Prisma.DateTimeNullableFilter = {};
        if (filters.follow_up_date_from) {
          followUpRange.gte = ApplicationService.parseDateOnly(
            filters.follow_up_date_from
          );
        }
        if (filters.follow_up_date_to) {
          followUpRange.lte = ApplicationService.parseDateOnly(
            filters.follow_up_date_to
          );
        }
        followUpConditions.push({ followUpDate: followUpRange });
      }

      if (filters.follow_up_overdue !== undefined) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (filters.follow_up_overdue) {
          followUpConditions.push({ followUpDate: { lt: today } });
        } else {
          followUpConditions.push({
            OR: [{ followUpDate: null }, { followUpDate: { gte: today } }],
          });
        }
      }

      if (followUpConditions.length) {
        where.AND = [
          ...ApplicationService.normalizeWhereAnd(where.AND),
          ...followUpConditions,
        ];
      }
    }

    if (filters.salary_from !== undefined || filters.salary_to !== undefined) {
      const salaryFilters: Prisma.ApplicationWhereInput[] = [
        {
          NOT: { AND: [{ salaryMin: null }, { salaryMax: null }] },
        },
      ];

      if (filters.salary_from !== undefined) {
        const fromValue = ApplicationService.toOptionalBigInt(
          filters.salary_from
        );
        if (fromValue !== null) {
          salaryFilters.push({
            OR: [{ salaryMax: { gte: fromValue } }, { salaryMax: null }],
          });
        }
      }

      if (filters.salary_to !== undefined) {
        const toValue = ApplicationService.toOptionalBigInt(filters.salary_to);
        if (toValue !== null) {
          salaryFilters.push({
            OR: [{ salaryMin: { lte: toValue } }, { salaryMin: null }],
          });
        }
      }

      where.AND = [
        ...ApplicationService.normalizeWhereAnd(where.AND),
        ...salaryFilters,
      ];
    }

    const sortField = sortFieldMap[filters.sort_by] ?? "date";
    const orderBy: Prisma.ApplicationOrderByWithRelationInput = {
      [sortField]: filters.sort_order,
    };

    const [totalItems, records] = await Promise.all([
      prisma.application.count({ where }),
      prisma.application.findMany({
        where,
        orderBy,
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    const totalPages =
      totalItems === 0 ? 0 : Math.ceil(totalItems / Math.max(perPage, 1));

    return {
      items: records.map((record) => ApplicationService.toResponse(record)),
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
  ): Promise<ApplicationResponse> {
    const payload: ApplicationPayloadInput = validate(
      ApplicationValidation.PAYLOAD,
      request
    );
    const now = new Date();
    const data = ApplicationService.mapPayloadToData(payload);

    const application = await prisma.application.create({
      data: {
        ...data,
        userId,
        createdAt: now,
        updatedAt: now,
      },
    });

    return ApplicationService.toResponse(application);
  }

  static async get(userId: string, id: string): Promise<ApplicationResponse> {
    const application = await ApplicationService.findOwnedApplication(
      userId,
      id
    );
    return ApplicationService.toResponse(application);
  }

  static async update(
    userId: string,
    id: string,
    request: unknown
  ): Promise<ApplicationResponse> {
    await ApplicationService.findOwnedApplication(userId, id);
    const payload: ApplicationPayloadInput = validate(
      ApplicationValidation.PAYLOAD,
      request
    );
    const data = ApplicationService.mapPayloadToData(payload);

    const application = await prisma.application.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });

    return ApplicationService.toResponse(application);
  }

  static async delete(userId: string, id: string): Promise<void> {
    await ApplicationService.findOwnedApplication(userId, id);
    await prisma.application.delete({
      where: { id },
    });
  }

  static async duplicate(
    userId: string,
    id: string
  ): Promise<ApplicationResponse> {
    const source = await ApplicationService.findOwnedApplication(userId, id);
    const now = new Date();

    const duplicate = await prisma.application.create({
      data: {
        userId,
        companyName: source.companyName,
        companyUrl: source.companyUrl,
        position: source.position,
        jobSource: source.jobSource,
        jobType: source.jobType,
        workSystem: source.workSystem,
        salaryMin: source.salaryMin,
        salaryMax: source.salaryMax,
        location: source.location,
        date: source.date,
        status: source.status,
        resultStatus: source.resultStatus,
        contactName: source.contactName,
        contactEmail: source.contactEmail,
        contactPhone: source.contactPhone,
        followUpDate: source.followUpDate,
        followUpNote: source.followUpNote,
        jobUrl: source.jobUrl,
        notes: source.notes,
        createdAt: now,
        updatedAt: now,
      },
    });

    return ApplicationService.toResponse(duplicate);
  }

  static async getStats(userId: string): Promise<{
    total_applications: number;
    active_applications: number;
    interview: number;
    offer: number;
    rejected: number;
    needs_followup: number;
    overdue: number;
    no_followup: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day for comparison

    const [
      totalApplications,
      activeApplications,
      interviewApplications,
      offerApplications,
      rejectedApplications,
      needsFollowupApplications,
      overdueApplications,
      noFollowupApplications,
    ] = await Promise.all([
      // Total applications
      prisma.application.count({
        where: { userId },
      }),

      // Active applications (not rejected or accepted)
      prisma.application.count({
        where: {
          userId,
          status: {
            notIn: ["rejected", "accepted"],
          },
        },
      }),

      // Interview stage applications
      prisma.application.count({
        where: {
          userId,
          status: {
            in: ["hr_interview", "user_interview", "final_interview"],
          },
        },
      }),

      // Offer stage applications
      prisma.application.count({
        where: {
          userId,
          status: "offering",
        },
      }),

      // Rejected applications
      prisma.application.count({
        where: {
          userId,
          status: "rejected",
        },
      }),

      // Applications that need follow-up (have follow-up date set)
      prisma.application.count({
        where: {
          userId,
          followUpDate: {
            not: null,
          },
        },
      }),

      // Overdue applications (follow-up date is in the past)
      prisma.application.count({
        where: {
          userId,
          followUpDate: {
            lt: today,
          },
          status: {
            notIn: ["rejected", "accepted"],
          },
        },
      }),

      // Applications without follow-up
      prisma.application.count({
        where: {
          userId,
          followUpDate: null,
          status: {
            notIn: ["rejected", "accepted"],
          },
        },
      }),
    ]);

    return {
      total_applications: totalApplications,
      active_applications: activeApplications,
      interview: interviewApplications,
      offer: offerApplications,
      rejected: rejectedApplications,
      needs_followup: needsFollowupApplications,
      overdue: overdueApplications,
      no_followup: noFollowupApplications,
    };
  }

  private static async findOwnedApplication(
    userId: string,
    id: string
  ): Promise<PrismaApplication> {
    const application = await prisma.application.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!application) {
      throw new ResponseError(404, "Lamaran tidak ditemukan");
    }

    return application;
  }

  private static mapPayloadToData(
    payload: ApplicationPayloadInput
  ): ApplicationMutableFields {
    return {
      companyName: payload.company_name,
      companyUrl: payload.company_url ?? null,
      position: payload.position,
      jobSource: payload.job_source ?? null,
      jobType: payload.job_type,
      workSystem: payload.work_system,
      salaryMin: ApplicationService.toOptionalBigInt(payload.salary_min),
      salaryMax: ApplicationService.toOptionalBigInt(payload.salary_max),
      location: payload.location ?? null,
      date: ApplicationService.parseDateOnly(payload.date),
      status: payload.status,
      resultStatus: payload.result_status,
      contactName: payload.contact_name ?? null,
      contactEmail: payload.contact_email ?? null,
      contactPhone: payload.contact_phone ?? null,
      followUpDate: ApplicationService.parseOptionalDate(
        payload.follow_up_date
      ),
      followUpNote: payload.follow_up_note ?? null,
      jobUrl: payload.job_url ?? null,
      notes: payload.notes ?? null,
    };
  }

  private static parseDateOnly(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
  }

  private static parseOptionalDate(value?: string | null): Date | null {
    if (!value) {
      return null;
    }
    return ApplicationService.parseDateOnly(value);
  }

  private static toOptionalBigInt(value?: number): bigint | null {
    if (value === null || value === undefined) {
      return null;
    }
    return BigInt(value);
  }

  private static toOptionalNumber(value?: bigint | null): number | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }
    return Number(value);
  }

  private static formatDateOnly(date?: Date | null): string | undefined {
    if (!date) {
      return undefined;
    }
    return date.toISOString().split("T")[0];
  }

  private static toResponse(
    application: PrismaApplication
  ): ApplicationResponse {
    return {
      id: application.id,
      user_id: application.userId,
      company_name: application.companyName,
      company_url: application.companyUrl ?? null,
      position: application.position,
      job_source: application.jobSource ?? null,
      job_type: application.jobType,
      work_system: application.workSystem,
      salary_min: ApplicationService.toOptionalNumber(application.salaryMin),
      salary_max: ApplicationService.toOptionalNumber(application.salaryMax),
      location: application.location ?? null,
      date: ApplicationService.formatDateOnly(application.date)!,
      status: application.status,
      result_status: application.resultStatus,
      contact_name: application.contactName ?? null,
      contact_email: application.contactEmail ?? null,
      contact_phone: application.contactPhone ?? null,
      follow_up_date: ApplicationService.formatDateOnly(
        application.followUpDate
      ),
      follow_up_note: application.followUpNote ?? null,
      job_url: application.jobUrl ?? null,
      notes: application.notes ?? null,
      created_at: application.createdAt?.toISOString(),
      updated_at: application.updatedAt?.toISOString(),
    };
  }

  static async massDelete(
    userId: string,
    request: unknown
  ): Promise<{ message: string; deleted_count: number }> {
    const { ids } = validate(ApplicationValidation.MASS_DELETE, request);

    // Verify all applications belong to user
    const applications = await prisma.application.findMany({
      where: {
        id: { in: ids },
        userId,
      },
      select: { id: true },
    });

    if (applications.length !== ids.length) {
      throw new ResponseError(
        404,
        "Beberapa lamaran tidak ditemukan atau bukan milik Anda"
      );
    }

    // Delete all applications
    const result = await prisma.application.deleteMany({
      where: {
        id: { in: ids },
        userId,
      },
    });

    return {
      message: `${result.count} lamaran berhasil dihapus`,
      deleted_count: result.count,
    };
  }
}
