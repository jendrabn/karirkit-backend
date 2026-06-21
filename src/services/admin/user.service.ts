import type {
  User,
  UserSocialLink,
  Prisma,
  Platform,
} from "../../generated/prisma/client";
import type { UserWhereInput } from "../../generated/prisma/models/User";
import bcrypt from "bcrypt";
import { prisma } from "../../config/prisma.config";
import { ResponseError } from "../../utils/response-error.util";
import { validate } from "../../utils/validate.util";
import { UserValidation } from "../../validations/admin/user.validation";
import { UsageStatsService, type UsageStats } from "../../services/usage-stats.service";
import { buildUserSubscriptionState } from "../../config/subscription-plans.config";
import {
  toUserProfile,
  type UserProfile,
} from "../../utils/user-profile.util";

type AdminUsage = {
  max_cvs: number;
  max_application_letters: number;
  max_applications: number;
  max_document_storage_bytes: number;
  max_cv_pdf_downloads: number;
  max_cv_docx_downloads: number;
  max_letter_pdf_downloads: number;
  max_letter_docx_downloads: number;
  max_cv_ai_improvements: number;
  max_application_letter_ai_improvements: number;
};

type SafeUser = UserProfile & {
  last_login_at: string | null;
  subscription_plan: User["subscriptionPlan"];
  subscription_expires_at: string | null;
  usage: AdminUsage;
};

type UserListResult = {
  items: SafeUser[];
  pagination: {
    page: number;
    per_page: number;
    total_items: number;
    total_pages: number;
  };
};

type CreateUserRequest = {
  name: string;
  username: string;
  email: string;
  password: string;
  phone?: string | null;
  headline?: string | null;
  bio?: string | null;
  location?: string | null;
  gender?: User["gender"] | null;
  birth_date?: string | null;
  role?: "user" | "admin";
  avatar?: string | null;
  social_links?: UserSocialLinkPayload[];
};

type UpdateUserRequest = {
  name?: string;
  username?: string;
  email?: string;
  password?: string | null;
  phone?: string | null;
  headline?: string | null;
  bio?: string | null;
  location?: string | null;
  gender?: User["gender"] | null;
  birth_date?: string | null;
  role?: "user" | "admin";
  avatar?: string | null;
  social_links?: UserSocialLinkPayload[];
  status?: "active" | "suspended" | "banned";
  status_reason?: string | null;
  suspended_until?: string | null;
};

type UserSocialLinkPayload = {
  id?: string | null;
  platform: Platform;
  url: string;
};

type RawUserRecord = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: User["role"];
  phone: string | null;
  headline: string | null;
  bio: string | null;
  location: string | null;
  gender: User["gender"] | null;
  birthDate: Date | null;
  avatar: string | null;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  subscriptionPlan: User["subscriptionPlan"];
  subscriptionExpiresAt: Date | null;
  status: User["status"];
  statusReason: string | null;
  suspendedUntil: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

const toAdminUsage = (stats: UsageStats): AdminUsage => ({
  max_cvs: stats.max_cvs.used,
  max_application_letters: stats.max_application_letters.used,
  max_applications: stats.max_applications.used,
  max_document_storage_bytes: stats.max_document_storage_bytes.used,
  max_cv_pdf_downloads: stats.max_cv_pdf_downloads.used,
  max_cv_docx_downloads: stats.max_cv_docx_downloads.used,
  max_letter_pdf_downloads: stats.max_letter_pdf_downloads.used,
  max_letter_docx_downloads: stats.max_letter_docx_downloads.used,
  max_cv_ai_improvements: stats.max_cv_ai_improvements.used,
  max_application_letter_ai_improvements: stats.max_application_letter_ai_improvements.used,
});

const toAdminUserProfile = (
  user: Pick<
    RawUserRecord,
    | "id"
    | "name"
    | "username"
    | "email"
    | "role"
    | "phone"
    | "headline"
    | "bio"
    | "location"
    | "gender"
    | "avatar"
    | "status"
    | "lastLoginAt"
    | "subscriptionPlan"
    | "subscriptionExpiresAt"
    | "createdAt"
    | "updatedAt"
    | "birthDate"
    | "emailVerifiedAt"
    | "statusReason"
    | "suspendedUntil"
  >,
  socialLinks: UserSocialLink[],
  usage: AdminUsage
): SafeUser => ({
  ...toUserProfile(user, socialLinks),
  last_login_at: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
  subscription_plan: user.subscriptionPlan,
  subscription_expires_at: user.subscriptionExpiresAt
    ? user.subscriptionExpiresAt.toISOString()
    : null,
  usage,
});

const getEmptyUsage = (_planId: string): AdminUsage => ({
  max_cvs: 0,
  max_application_letters: 0,
  max_applications: 0,
  max_document_storage_bytes: 0,
  max_cv_pdf_downloads: 0,
  max_cv_docx_downloads: 0,
  max_letter_pdf_downloads: 0,
  max_letter_docx_downloads: 0,
  max_cv_ai_improvements: 0,
  max_application_letter_ai_improvements: 0,
});

const normalizeNullableString = (
  value?: string | null
): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (value === "" || value === null) {
    return null;
  }
  return value;
};

const normalizeNullableDate = (value?: string | null): Date | null | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (!value) {
    return null;
  }
  return new Date(value);
};

// Schemas moved to UserValidation

const USAGE_SORT_FIELDS = [
  "max_cvs",
  "max_application_letters",
  "max_applications",
  "max_document_storage_bytes",
  "max_cv_pdf_downloads",
  "max_cv_docx_downloads",
  "max_letter_pdf_downloads",
  "max_letter_docx_downloads",
  "max_cv_ai_improvements",
  "max_application_letter_ai_improvements",
] as const;

const sortFieldMap = {
  created_at: "createdAt",
  updated_at: "updatedAt",
  name: "name",
  email: "email",
  role: "role",
  status: "status",
} as const;

export class UserService {
  private static normalizeWhereAnd(
    value: UserWhereInput["AND"]
  ): UserWhereInput[] {
    if (!value) {
      return [];
    }
    return Array.isArray(value) ? value : [value];
  }

  private static buildStatusUpdate(
    status: "active" | "suspended" | "banned",
    statusReason?: string | null,
    suspendedUntil?: string | null
  ): {
    status: "active" | "suspended" | "banned";
    statusReason: string | null;
    suspendedUntil: Date | null;
  } {
    let suspendedUntilDate: Date | null = null;
    if (status === "suspended" && suspendedUntil?.trim()) {
      suspendedUntilDate = new Date(suspendedUntil);
      if (Number.isNaN(suspendedUntilDate.getTime())) {
        throw new ResponseError(400, "Tanggal penangguhan tidak valid");
      }
    }

    let normalizedReason: string | null = null;
    if (status !== "active" && statusReason?.trim()) {
      normalizedReason = statusReason.trim();
    }

    return {
      status,
      statusReason: normalizedReason,
      suspendedUntil: status === "suspended" ? suspendedUntilDate : null,
    };
  }

  static async list(query: unknown): Promise<UserListResult> {
    const requestData = validate(UserValidation.LIST_QUERY, query);
    const page = requestData.page;
    const perPage = requestData.per_page;

    const where: UserWhereInput = {};

    if (requestData.q) {
      const search = requestData.q;
      where.OR = [
        { name: { contains: search } },
        { username: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
        { location: { contains: search } },
      ];
    }

    if (requestData.role?.length) {
      where.role = { in: requestData.role };
    }

    if (requestData.status?.length) {
      where.status = { in: requestData.status };
    }

    if (requestData.gender?.length) {
      where.gender = { in: requestData.gender };
    }

    if (requestData.email_verified !== undefined) {
      where.emailVerifiedAt = requestData.email_verified ? { not: null } : null;
    }

    if (requestData.suspended !== undefined) {
      const now = new Date();
      if (requestData.suspended) {
        where.suspendedUntil = { gt: now };
      } else {
        where.AND = [
          ...UserService.normalizeWhereAnd(where.AND),
          {
            OR: [
              { suspendedUntil: null },
              { suspendedUntil: { lte: now } },
            ],
          },
        ];
      }
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

    const usageFilterKeys = [
      "max_cvs",
      "max_application_letters",
      "max_applications",
      "max_document_storage_bytes",
      "max_cv_pdf_downloads",
      "max_cv_docx_downloads",
      "max_letter_pdf_downloads",
      "max_letter_docx_downloads",
      "max_cv_ai_improvements",
      "max_application_letter_ai_improvements",
    ] as const;

    const needsDerivedData = (["_from", "_to"] as const).some((suffix) =>
      usageFilterKeys.some((key) => {
        const fromKey = `${key}${suffix === "_from" ? "_from" : "_to"}`;
        return (requestData as any)[fromKey] !== undefined;
      })
    ) || USAGE_SORT_FIELDS.includes(requestData.sort_by as any);

    const selectFields = {
      id: true,
      name: true,
      username: true,
      email: true,
      role: true,
      phone: true,
      headline: true,
      bio: true,
      location: true,
      gender: true,
      birthDate: true,
      avatar: true,
      emailVerifiedAt: true,
      lastLoginAt: true,
      subscriptionPlan: true,
      subscriptionExpiresAt: true,
      status: true,
      statusReason: true,
      suspendedUntil: true,
      createdAt: true,
      updatedAt: true,
    } satisfies Prisma.UserSelect;

    const [totalItems, records] = needsDerivedData
      ? [
          null,
          await prisma.user.findMany({
            where,
            select: selectFields,
          }),
        ]
      : await Promise.all([
          prisma.user.count({ where }),
          prisma.user.findMany({
            where,
            orderBy: {
              [sortFieldMap[requestData.sort_by as keyof typeof sortFieldMap] ??
              "createdAt"]: requestData.sort_order,
            },
            skip: (page - 1) * perPage,
            take: perPage,
            select: selectFields,
          }),
        ]);

    const userIds = records.map((user) => user.id);

    const socialLinks = userIds.length
      ? await prisma.userSocialLink.findMany({
          where: { userId: { in: userIds } },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        })
      : [];
    const socialLinksByUser = socialLinks.reduce<
      Record<string, UserSocialLink[]>
    >((acc, link) => {
      if (!acc[link.userId]) {
        acc[link.userId] = [];
      }
      acc[link.userId].push(link);
      return acc;
    }, {});

    const usageMap = userIds.length
      ? await UsageStatsService.getBatchLifetimeUsageStats(userIds)
      : {};

    const usersWithUsage = records.map((user) => ({
      user: toAdminUserProfile(
        user,
        socialLinksByUser[user.id] ?? [],
        usageMap[user.id]
          ? toAdminUsage(usageMap[user.id])
          : getEmptyUsage(user.subscriptionPlan)
      ),
    }));

    const applyUsageFilters = (
      items: { user: SafeUser }[]
    ) =>
      items.filter(({ user: u }) => {
        for (const key of usageFilterKeys) {
          const fromKey = `${key}_from` as keyof typeof requestData;
          const toKey = `${key}_to` as keyof typeof requestData;
          const fromVal = requestData[fromKey] as number | undefined;
          const toVal = requestData[toKey] as number | undefined;
          const usedVal = (u.usage as any)[key];
          if (fromVal !== undefined && usedVal < fromVal) return false;
          if (toVal !== undefined && usedVal > toVal) return false;
        }
        return true;
      });

    const sortUsers = (items: { user: SafeUser }[]) => {
      const direction = requestData.sort_order === "asc" ? 1 : -1;
      const sortBy = requestData.sort_by;
      const getStringValue = (value: string | null) => value ?? "";
      return [...items].sort((a, b) => {
        let left: number | string = 0;
        let right: number | string = 0;
        switch (sortBy) {
          case "name":
            left = getStringValue(a.user.name);
            right = getStringValue(b.user.name);
            break;
          case "email":
            left = getStringValue(a.user.email);
            right = getStringValue(b.user.email);
            break;
          case "role":
            left = getStringValue(a.user.role);
            right = getStringValue(b.user.role);
            break;
          case "status":
            left = getStringValue(a.user.status);
            right = getStringValue(b.user.status);
            break;
          case "updated_at":
            left = Date.parse(a.user.updated_at ?? "");
            right = Date.parse(b.user.updated_at ?? "");
            break;
          case "created_at":
          default: {
            if (USAGE_SORT_FIELDS.includes(sortBy as any)) {
              left = (a.user.usage as any)[sortBy] ?? 0;
              right = (b.user.usage as any)[sortBy] ?? 0;
              break;
            }
            left = Date.parse(a.user.created_at ?? "");
            right = Date.parse(b.user.created_at ?? "");
            break;
          }
        }

        if (left < right) return -1 * direction;
        if (left > right) return 1 * direction;
        return 0;
      });
    };

    const filteredUsers = needsDerivedData
      ? sortUsers(applyUsageFilters(usersWithUsage))
      : usersWithUsage;

    const totalFilteredItems = needsDerivedData
      ? filteredUsers.length
      : totalItems ?? 0;
    const totalPages =
      totalFilteredItems === 0
        ? 0
        : Math.ceil(totalFilteredItems / Math.max(perPage, 1));
    const pagedItems = needsDerivedData
      ? filteredUsers.slice((page - 1) * perPage, page * perPage)
      : filteredUsers;

    return {
      items: pagedItems.map((item) => item.user),
      pagination: {
        page,
        per_page: perPage,
        total_items: totalFilteredItems,
        total_pages: totalPages,
      },
    };
  }

  static async get(id: string): Promise<SafeUser> {
    const user = await prisma.user.findFirst({
      where: { id },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        phone: true,
        headline: true,
        bio: true,
        location: true,
        gender: true,
        birthDate: true,
        avatar: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        subscriptionPlan: true,
        subscriptionExpiresAt: true,
        status: true,
        statusReason: true,
        suspendedUntil: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new ResponseError(404, "Pengguna tidak ditemukan");
    }

    const [socialLinks, rawUsage] = await Promise.all([
      prisma.userSocialLink.findMany({
        where: { userId: id },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
      UsageStatsService.getLifetimeUsageStats(id),
    ]);
    return toAdminUserProfile(user, socialLinks, toAdminUsage(rawUsage));
  }

  static async create(request: CreateUserRequest): Promise<SafeUser> {
    const requestData = validate(UserValidation.CREATE, request);
    const freePlan = buildUserSubscriptionState("free");

    // Check if email already exists
    const existingEmail = await prisma.user.count({
      where: { email: requestData.email },
    });

    if (existingEmail > 0) {
      throw new ResponseError(400, "Email sudah terdaftar");
    }

    // Check if username already exists
    const existingUsername = await prisma.user.count({
      where: { username: requestData.username },
    });

    if (existingUsername > 0) {
      throw new ResponseError(400, "Username sudah terdaftar");
    }

    const hashedPassword = await bcrypt.hash(requestData.password, 10);

    const normalizedHeadline = normalizeNullableString(requestData.headline);
    const normalizedBio = normalizeNullableString(requestData.bio);
    const normalizedLocation = normalizeNullableString(requestData.location);
    const normalizedAvatar = normalizeNullableString(requestData.avatar);
    const normalizedBirthDate = normalizeNullableDate(requestData.birth_date);
    const normalizedGender = requestData.gender ? requestData.gender : null;

    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: requestData.name,
          username: requestData.username,
          email: requestData.email,
          password: hashedPassword,
          phone: requestData.phone ?? null,
          headline: normalizedHeadline,
          bio: normalizedBio,
          location: normalizedLocation,
          gender: normalizedGender,
          birthDate: normalizedBirthDate,
          role: requestData.role,
          avatar: normalizedAvatar,
          subscriptionPlan: freePlan.subscriptionPlan,
          subscriptionExpiresAt: freePlan.subscriptionExpiresAt,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          role: true,
          phone: true,
          headline: true,
          bio: true,
          location: true,
          gender: true,
          birthDate: true,
          avatar: true,
          emailVerifiedAt: true,
          lastLoginAt: true,
          subscriptionPlan: true,
          subscriptionExpiresAt: true,
          status: true,
          statusReason: true,
          suspendedUntil: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (requestData.social_links?.length) {
        await tx.userSocialLink.createMany({
          data: requestData.social_links.map((link) => ({
            userId: createdUser.id,
            platform: link.platform,
            url: link.url,
          })),
        });
      }

      return createdUser;
    });

    const socialLinks = await prisma.userSocialLink.findMany({
      where: { userId: user.id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return toAdminUserProfile(user, socialLinks, getEmptyUsage(user.subscriptionPlan));
  }

  static async update(
    id: string,
    request: UpdateUserRequest
  ): Promise<SafeUser> {
    // Check if user exists
    const existingUser = await prisma.user.findFirst({
      where: { id },
    });

    if (!existingUser) {
      throw new ResponseError(404, "Pengguna tidak ditemukan");
    }

    const requestData = validate(UserValidation.UPDATE, request);

    // Check if email already exists (excluding current user)
    if (requestData.email && requestData.email !== existingUser.email) {
      const emailExists = await prisma.user.count({
        where: {
          email: requestData.email,
          NOT: { id },
        },
      });

      if (emailExists > 0) {
        throw new ResponseError(400, "Email sudah terdaftar");
      }
    }

    // Check if username already exists (excluding current user)
    if (
      requestData.username &&
      requestData.username !== existingUser.username
    ) {
      const usernameExists = await prisma.user.count({
        where: {
          username: requestData.username,
          NOT: { id },
        },
      });

      if (usernameExists > 0) {
        throw new ResponseError(400, "Username sudah terdaftar");
      }
    }

    const updateData: Prisma.UserUpdateInput = {
      updatedAt: new Date(),
    };

    if (requestData.name !== undefined) {
      updateData.name = requestData.name;
    }

    if (requestData.username !== undefined) {
      updateData.username = requestData.username;
    }

    if (requestData.email !== undefined) {
      updateData.email = requestData.email;
    }

    if (typeof requestData.password === "string") {
      const trimmedPassword = requestData.password.trim();
      if (trimmedPassword) {
        updateData.password = await bcrypt.hash(trimmedPassword, 10);
        updateData.passwordResetTokenId = null;
        updateData.sessionInvalidBefore = new Date();
      }
    }

    if (requestData.phone !== undefined) {
      updateData.phone = requestData.phone;
    }

    if (requestData.headline !== undefined) {
      updateData.headline = normalizeNullableString(requestData.headline);
    }

    if (requestData.bio !== undefined) {
      updateData.bio = normalizeNullableString(requestData.bio);
    }

    if (requestData.location !== undefined) {
      updateData.location = normalizeNullableString(requestData.location);
    }

    if (requestData.gender !== undefined) {
      updateData.gender = requestData.gender || null;
    }

    if (requestData.birth_date !== undefined) {
      updateData.birthDate = normalizeNullableDate(requestData.birth_date);
    }

    if (requestData.role !== undefined) {
      updateData.role = requestData.role;
    }

    if (requestData.avatar !== undefined) {
      updateData.avatar = normalizeNullableString(requestData.avatar);
    }

    if (
      requestData.status === undefined &&
      (requestData.status_reason !== undefined ||
        requestData.suspended_until !== undefined)
    ) {
      throw new ResponseError(
        400,
        "Status wajib diisi untuk memperbarui alasan atau tanggal penangguhan"
      );
    }

    if (requestData.status !== undefined) {
      const statusUpdate = UserService.buildStatusUpdate(
        requestData.status,
        requestData.status_reason,
        requestData.suspended_until
      );
      updateData.status = statusUpdate.status;
      updateData.statusReason = statusUpdate.statusReason;
      updateData.suspendedUntil = statusUpdate.suspendedUntil;
    }

    const socialLinkPayload = requestData.social_links ?? undefined;
    const socialLinkIds = socialLinkPayload
      ? socialLinkPayload
          .map((link) => link.id)
          .filter((linkId): linkId is string => Boolean(linkId))
      : [];
    if (socialLinkPayload) {
      const existingLinks = await prisma.userSocialLink.findMany({
        where: { userId: id },
        select: { id: true },
      });
      const existingIds = new Set(existingLinks.map((link) => link.id));
      const invalidIds = socialLinkIds.filter((linkId) => !existingIds.has(linkId));
      if (invalidIds.length > 0) {
        throw new ResponseError(400, "Social link tidak ditemukan");
      }
    }

    const user = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          role: true,
          phone: true,
          headline: true,
          bio: true,
          location: true,
          gender: true,
          birthDate: true,
          avatar: true,
          emailVerifiedAt: true,
          lastLoginAt: true,
          subscriptionPlan: true,
          subscriptionExpiresAt: true,
          status: true,
          statusReason: true,
          suspendedUntil: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (socialLinkPayload) {
        await tx.userSocialLink.deleteMany({
          where: {
            userId: id,
            ...(socialLinkIds.length ? { id: { notIn: socialLinkIds } } : {}),
          },
        });

        await Promise.all(
          socialLinkPayload.map((link) => {
            if (link.id) {
              return tx.userSocialLink.update({
                where: { id: link.id },
                data: {
                  platform: link.platform,
                  url: link.url,
                },
              });
            }

            return tx.userSocialLink.create({
              data: {
                userId: id,
                platform: link.platform,
                url: link.url,
              },
            });
          })
        );
      }

      return updatedUser;
    });

    const [socialLinks, rawUsage] = await Promise.all([
      prisma.userSocialLink.findMany({
        where: { userId: id },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
      UsageStatsService.getLifetimeUsageStats(id),
    ]);
    return toAdminUserProfile(user, socialLinks, toAdminUsage(rawUsage));
  }

  static async updateStatus(id: string, request: unknown): Promise<SafeUser> {
    const existingUser = await prisma.user.findFirst({
      where: { id },
    });

    if (!existingUser) {
      throw new ResponseError(404, "Pengguna tidak ditemukan");
    }

    const requestData = validate(UserValidation.STATUS_UPDATE, request);
    const statusUpdate = UserService.buildStatusUpdate(
      requestData.status,
      requestData.status_reason,
      requestData.suspended_until
    );

    const user = await prisma.user.update({
      where: { id },
      data: {
        updatedAt: new Date(),
        status: statusUpdate.status,
        statusReason: statusUpdate.statusReason,
        suspendedUntil: statusUpdate.suspendedUntil,
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        phone: true,
        headline: true,
        bio: true,
        location: true,
        gender: true,
        birthDate: true,
        avatar: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        subscriptionPlan: true,
        subscriptionExpiresAt: true,
        status: true,
        statusReason: true,
        suspendedUntil: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const [socialLinks, rawUsage] = await Promise.all([
      prisma.userSocialLink.findMany({
        where: { userId: id },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
      UsageStatsService.getLifetimeUsageStats(id),
    ]);
    return toAdminUserProfile(user, socialLinks, toAdminUsage(rawUsage));
  }

  static async delete(id: string): Promise<void> {
    // Check if user exists
    const existingUser = await prisma.user.findFirst({
      where: { id },
    });

    if (!existingUser) {
      throw new ResponseError(404, "Pengguna tidak ditemukan");
    }

    // Hard delete
    await prisma.user.delete({
      where: { id },
    });
  }

  static async massDelete(
    request: unknown
  ): Promise<{ message: string; deleted_count: number }> {
    const { ids } = validate(UserValidation.MASS_DELETE, request);

    // Verify all users exist (including already deleted ones for mass delete)
    const users = await prisma.user.findMany({
      where: {
        id: { in: ids },
      },
    });

    if (users.length !== ids.length) {
      throw new ResponseError(404, "Satu atau lebih pengguna tidak ditemukan");
    }

    // Hard delete users
    const result = await prisma.user.deleteMany({
      where: {
        id: { in: ids },
      },
    });

    return {
      message: `${result.count} pengguna berhasil dihapus`,
      deleted_count: result.count,
    };
  }

}
