import type { User, UserSocialLink } from "../generated/prisma/client";
import bcrypt from "bcrypt";
import { prisma } from "../config/prisma.config";
import { ChangePasswordRequest, UpdateMeRequest } from "../types/api-schemas";
import { ResponseError } from "../utils/response-error.util";
import { UploadService } from "../services/upload.service";
import { DownloadLogService, type DownloadStats } from "./download-log.service";
import {
  DocumentService,
  type DocumentStorageStats,
} from "./document.service";
import { validate } from "../utils/validate.util";
import { AccountValidation } from "../validations/account.validation";

export type SafeUser = Omit<User, "password" | "createdAt" | "updatedAt"> & {
  created_at: string | null;
  updated_at: string | null;
  birth_date: string | null;
  email_verified_at: string | null;
  daily_download_limit: number;
  document_storage_limit: number;
  social_links: {
    id: string;
    user_id: string;
    platform: string;
    url: string;
  }[];
  download_stats: DownloadStats;
  document_storage_stats: DocumentStorageStats;
};

const toSafeUser = (
  user: User,
  socialLinks: UserSocialLink[],
  downloadStats: DownloadStats,
  storageStats: DocumentStorageStats
): SafeUser => {
  const {
    password: _password,
    createdAt,
    updatedAt,
    birthDate,
    emailVerifiedAt,
    dailyDownloadLimit,
    documentStorageLimit,
    statusReason,
    suspendedUntil,
    ...rest
  } = user;
  return {
    id: rest.id,
    name: rest.name,
    username: rest.username,
    email: rest.email,
    phone: rest.phone,
    headline: rest.headline,
    bio: rest.bio,
    location: rest.location,
    gender: rest.gender,
    role: rest.role,
    avatar: rest.avatar,
    status: rest.status,
    status_reason: statusReason,
    suspended_until: suspendedUntil ? suspendedUntil.toISOString() : null,
    birth_date: birthDate ? birthDate.toISOString().slice(0, 10) : null,
    email_verified_at: emailVerifiedAt ? emailVerifiedAt.toISOString() : null,
    daily_download_limit: dailyDownloadLimit,
    document_storage_limit: documentStorageLimit,
    social_links: socialLinks.map((record) => ({
      id: record.id,
      user_id: record.userId,
      platform: record.platform,
      url: record.url,
    })),
    created_at: createdAt ? createdAt.toISOString() : null,
    updated_at: updatedAt ? updatedAt.toISOString() : null,
    download_stats: downloadStats,
    document_storage_stats: storageStats,
  };
};

export class AccountService {
  static async me(userId: string): Promise<SafeUser> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        socialLinks: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
      },
    });

    if (!user) {
      throw new ResponseError(401, "Tidak terautentikasi");
    }

    const [downloadStats, storageStats] = await Promise.all([
      DownloadLogService.getDownloadStats(userId),
      DocumentService.getStorageStats(userId),
    ]);
    return toSafeUser(user, user.socialLinks, downloadStats, storageStats);
  }

  static async updateMe(
    userId: string,
    request: UpdateMeRequest
  ): Promise<SafeUser> {
    const requestData = validate(AccountValidation.UPDATE_ME, request);

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      throw new ResponseError(401, "Tidak terautentikasi");
    }

    if (requestData.email && requestData.email !== existingUser.email) {
      const emailExists = await prisma.user.count({
        where: {
          email: requestData.email,
          NOT: { id: userId },
        },
      });

      if (emailExists > 0) {
        throw new ResponseError(400, "Email sudah terdaftar");
      }
    }

    if (
      requestData.username &&
      requestData.username !== existingUser.username
    ) {
      const usernameExists = await prisma.user.count({
        where: {
          username: requestData.username,
          NOT: { id: userId },
        },
      });

      if (usernameExists > 0) {
        throw new ResponseError(400, "Username sudah terdaftar");
      }
    }

    const updateData: {
      name?: string;
      username?: string;
      email?: string;
      phone?: string | null;
      headline?: string | null;
      bio?: string | null;
      location?: string | null;
      gender?: User["gender"];
      birthDate?: Date | null;
      avatar?: string | null;
      updatedAt?: Date;
    } = {};

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

    if (requestData.headline !== undefined) {
      updateData.headline = requestData.headline || null;
    }

    if (requestData.bio !== undefined) {
      updateData.bio = requestData.bio || null;
    }

    if (requestData.location !== undefined) {
      updateData.location = requestData.location || null;
    }

    if (requestData.gender !== undefined) {
      updateData.gender = requestData.gender || null;
    }

    if (requestData.birth_date !== undefined) {
      updateData.birthDate = requestData.birth_date
        ? new Date(requestData.birth_date)
        : null;
    }

    if (requestData.avatar !== undefined) {
      // If avatar is provided and it's a temp path, move it to the avatars folder
      if (
        requestData.avatar &&
        requestData.avatar.startsWith("/uploads/temp/")
      ) {
        try {
          const avatarPath = await UploadService.moveFromTemp(
            "avatars",
            requestData.avatar
          );
          updateData.avatar = avatarPath;
        } catch (error) {
          throw new ResponseError(400, "Gagal memindahkan avatar");
        }
      } else {
        updateData.avatar = requestData.avatar;
      }
    }

    updateData.updatedAt = new Date();

    const socialLinkPayload = requestData.social_links ?? undefined;
    const socialLinkIds = socialLinkPayload
      ? socialLinkPayload
          .map((link) => link.id)
          .filter((id): id is string => Boolean(id))
      : [];
    if (socialLinkPayload) {
      const existingLinks = await prisma.userSocialLink.findMany({
        where: { userId },
        select: { id: true },
      });
      const existingIds = new Set(existingLinks.map((link) => link.id));
      const invalidIds = socialLinkIds.filter((id) => !existingIds.has(id));
      if (invalidIds.length > 0) {
        throw new ResponseError(400, "Social link tidak ditemukan");
      }
    }

    const user = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: updateData,
        include: {
          socialLinks: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          },
        },
      });

      if (socialLinkPayload) {
        await tx.userSocialLink.deleteMany({
          where: {
            userId,
            ...(socialLinkIds.length
              ? { id: { notIn: socialLinkIds } }
              : {}),
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
                userId,
                platform: link.platform,
                url: link.url,
              },
            });
          })
        );
      }

      return updatedUser;
    });

    const [downloadStats, storageStats] = await Promise.all([
      DownloadLogService.getDownloadStats(userId),
      DocumentService.getStorageStats(userId),
    ]);
    const socialLinks = await prisma.userSocialLink.findMany({
      where: { userId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return toSafeUser(user, socialLinks, downloadStats, storageStats);
  }

  static async changePassword(
    userId: string,
    request: ChangePasswordRequest
  ): Promise<void> {
    const requestData = validate(AccountValidation.CHANGE_PASSWORD, request);
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new ResponseError(401, "Tidak terautentikasi");
    }

    const isMatch = await bcrypt.compare(
      requestData.current_password,
      user.password
    );

    if (!isMatch) {
      throw new ResponseError(400, "Kata sandi saat ini salah");
    }

    if (requestData.current_password === requestData.new_password) {
      throw new ResponseError(
        400,
        "Kata sandi baru harus berbeda dengan kata sandi saat ini"
      );
    }

    const hashedPassword = await bcrypt.hash(requestData.new_password, 10);

    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        updatedAt: new Date(),
      },
    });
  }
}
