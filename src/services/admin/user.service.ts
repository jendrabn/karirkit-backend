import type { User, Prisma } from "../../generated/prisma/client";
import bcrypt from "bcrypt";
import { prisma } from "../../config/prisma.config";
import { ResponseError } from "../../utils/response-error.util";
import { validate } from "../../utils/validate.util";
import { UserValidation } from "../../validations/admin/user.validation";
import {
  DownloadLogService,
  type DownloadStats,
} from "../../services/download-log.service";

type SafeUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
  phone: string | null;
  avatar: string | null;
  daily_download_limit: number;
  document_storage_limit: number;
  document_storage_stats: {
    limit: number;
    used: number;
    remaining: number;
  };
  status: string;
  status_reason: string | null;
  suspended_until: string | null;
  created_at: string;
  updated_at: string;
  download_stats: DownloadStats;
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
  role?: "user" | "admin";
  avatar?: string | null;
  daily_download_limit?: number;
  document_storage_limit?: number;
};

type UpdateUserRequest = {
  name?: string;
  username?: string;
  email?: string;
  phone?: string | null;
  role?: "user" | "admin";
  avatar?: string | null;
  daily_download_limit?: number;
  document_storage_limit?: number;
  status?: "active" | "suspended" | "banned";
  status_reason?: string | null;
  suspended_until?: string | null;
};

type RawUserRecord = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
  phone: string | null;
  avatar: string | null;
  dailyDownloadLimit: number;
  documentStorageLimit: number;
  status: string;
  statusReason: string | null;
  suspendedUntil: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

const DEFAULT_DOCUMENT_STORAGE_LIMIT = 100 * 1024 * 1024;
const BYTES_PER_MB = 1024 * 1024;

const buildDownloadStats = (
  user: RawUserRecord,
  todayCounts: Record<string, number>,
  totalCounts: Record<string, number>
): DownloadStats => {
  const limit = user.role === "admin" ? 999999 : user.dailyDownloadLimit;
  const todayCount = todayCounts[user.id] ?? 0;
  const totalCount = totalCounts[user.id] ?? 0;

  return {
    daily_limit: limit,
    today_count: todayCount,
    remaining:
      limit === 999999 ? 999999 : Math.max(0, limit - todayCount),
    total_count: totalCount,
  };
};

const formatSafeUser = (
  user: RawUserRecord,
  downloadStats: DownloadStats,
  storageUsed: number
): SafeUser => ({
  id: user.id,
  name: user.name,
  username: user.username,
  email: user.email,
  role: user.role,
  phone: user.phone,
  avatar: user.avatar,
  daily_download_limit: user.dailyDownloadLimit,
  document_storage_limit: user.documentStorageLimit,
  document_storage_stats: buildDocumentStorageStats(
    user.documentStorageLimit,
    storageUsed
  ),
  status: user.status,
  status_reason: user.statusReason,
  suspended_until: user.suspendedUntil
    ? user.suspendedUntil.toISOString()
    : null,
  created_at: user.createdAt?.toISOString() || "",
  updated_at: user.updatedAt?.toISOString() || "",
  download_stats: downloadStats,
});

const buildDocumentStorageStats = (
  limit: number,
  used: number
): { limit: number; used: number; remaining: number } => ({
  limit,
  used,
  remaining: Math.max(0, limit - used),
});

const getStorageUsageForUser = async (userId: string): Promise<number> => {
  const usage = await prisma.document.aggregate({
    where: { userId },
    _sum: { size: true },
  });
  return usage._sum.size ?? 0;
};
// Schemas moved to UserValidation

const sortFieldMap = {
  created_at: "createdAt",
  updated_at: "updatedAt",
  name: "name",
  username: "username",
  email: "email",
  role: "role",
} as const;

export class UserService {
  static async list(query: unknown): Promise<UserListResult> {
    const requestData = validate(UserValidation.LIST_QUERY, query);
    const page = requestData.page;
    const perPage = requestData.per_page;

    const where: Prisma.UserWhereInput = {};

    if (requestData.q) {
      const search = requestData.q;
      where.OR = [
        { name: { contains: search } },
        { username: { contains: search } },
        { email: { contains: search } },
      ];
    }

    if (requestData.role) {
      where.role = requestData.role;
    }

    if (requestData.created_from || requestData.created_to) {
      where.createdAt = {};

      if (requestData.created_from) {
        where.createdAt.gte = new Date(
          `${requestData.created_from}T00:00:00.000Z`
        );
      }

      if (requestData.created_to) {
        where.createdAt.lte = new Date(
          `${requestData.created_to}T23:59:59.999Z`
        );
      }
    }

    const sortField =
      sortFieldMap[requestData.sort_by as keyof typeof sortFieldMap] ??
      "createdAt";
    const orderBy: Prisma.UserOrderByWithRelationInput = {
      [sortField]: requestData.sort_order,
    };

    const [totalItems, records] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy,
        skip: (page - 1) * perPage,
        take: perPage,
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          role: true,
          phone: true,
          avatar: true,
          dailyDownloadLimit: true,
          documentStorageLimit: true,
          status: true,
          statusReason: true,
          suspendedUntil: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    const totalPages =
      totalItems === 0 ? 0 : Math.ceil(totalItems / Math.max(perPage, 1));

    const userIds = records.map((user) => user.id);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayCounts, totalCounts, storageUsageRows] = await Promise.all([
      DownloadLogService.countDownloadsByUsers(userIds, today),
      DownloadLogService.countDownloadsByUsers(userIds),
      userIds.length
        ? prisma.document.groupBy({
            by: ["userId"],
            where: { userId: { in: userIds } },
            _sum: { size: true },
          })
        : Promise.resolve([]),
    ]);

    const storageUsage = storageUsageRows.reduce<Record<string, number>>(
      (acc, row) => {
        acc[row.userId] = row._sum.size ?? 0;
        return acc;
      },
      {}
    );

    return {
      items: records.map((user) => {
        const downloadStats = buildDownloadStats(user, todayCounts, totalCounts);
        return formatSafeUser(
          user,
          downloadStats,
          storageUsage[user.id] ?? 0
        );
      }),
      pagination: {
        page,
        per_page: perPage,
        total_items: totalItems,
        total_pages: totalPages,
      },
    };
  }

  static async get(id: string): Promise<SafeUser> {
    const user = await prisma.user.findFirst({
      where: {
        id,
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        phone: true,
        avatar: true,
        dailyDownloadLimit: true,
        documentStorageLimit: true,
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

    const [downloadStats, storageUsed] = await Promise.all([
      DownloadLogService.getDownloadStats(id),
      getStorageUsageForUser(id),
    ]);
    return formatSafeUser(user, downloadStats, storageUsed);
  }

  static async create(request: CreateUserRequest): Promise<SafeUser> {
    const requestData = validate(UserValidation.CREATE, request);

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

    const user = await prisma.user.create({
      data: {
        name: requestData.name,
        username: requestData.username,
        email: requestData.email,
        password: hashedPassword,
        phone: requestData.phone ?? null,
        role: requestData.role,
        avatar: requestData.avatar ?? null,
        dailyDownloadLimit: requestData.daily_download_limit ?? 10,
        documentStorageLimit:
          requestData.document_storage_limit === undefined
            ? DEFAULT_DOCUMENT_STORAGE_LIMIT
            : Math.floor(requestData.document_storage_limit * BYTES_PER_MB),
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
        avatar: true,
        dailyDownloadLimit: true,
        documentStorageLimit: true,
        status: true,
        statusReason: true,
        suspendedUntil: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const [downloadStats, storageUsed] = await Promise.all([
      DownloadLogService.getDownloadStats(user.id),
      getStorageUsageForUser(user.id),
    ]);
    return formatSafeUser(user, downloadStats, storageUsed);
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

    if (requestData.phone !== undefined) {
      updateData.phone = requestData.phone;
    }

    if (requestData.role !== undefined) {
      updateData.role = requestData.role;
    }

    if (requestData.avatar !== undefined) {
      updateData.avatar = requestData.avatar;
    }

    if (requestData.daily_download_limit !== undefined) {
      updateData.dailyDownloadLimit = requestData.daily_download_limit;
    }

    if (requestData.document_storage_limit !== undefined) {
      updateData.documentStorageLimit = Math.floor(
        requestData.document_storage_limit * BYTES_PER_MB
      );
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
      let suspendedUntil: Date | null = null;
      if (
        requestData.status === "suspended" &&
        requestData.suspended_until &&
        requestData.suspended_until.trim().length > 0
      ) {
        suspendedUntil = new Date(requestData.suspended_until);
        if (Number.isNaN(suspendedUntil.getTime())) {
          throw new ResponseError(400, "Tanggal penangguhan tidak valid");
        }
      }

      let statusReason: string | null = null;
      if (
        requestData.status !== "active" &&
        requestData.status_reason &&
        requestData.status_reason.trim().length > 0
      ) {
        statusReason = requestData.status_reason.trim();
      }

      updateData.status = requestData.status;
      updateData.statusReason = statusReason;
      updateData.suspendedUntil =
        requestData.status === "suspended" ? suspendedUntil : null;
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        phone: true,
        avatar: true,
        dailyDownloadLimit: true,
        documentStorageLimit: true,
        status: true,
        statusReason: true,
        suspendedUntil: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const [downloadStats, storageUsed] = await Promise.all([
      DownloadLogService.getDownloadStats(user.id),
      getStorageUsageForUser(user.id),
    ]);
    return formatSafeUser(user, downloadStats, storageUsed);
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
