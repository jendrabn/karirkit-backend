import type { User } from "../generated/prisma/client";
import bcrypt from "bcrypt";
import { prisma } from "../config/prisma.config";
import { ChangePasswordRequest, UpdateMeRequest } from "../types/api-schemas";
import { ResponseError } from "../utils/response-error.util";
import { UploadService } from "../services/upload.service";
import { validate } from "../utils/validate.util";
import { DownloadLogService } from "./download-log.service";
import {
  toAccountUserProfile,
  type AccountUserProfile,
} from "../utils/user-profile.util";
import { AccountValidation } from "../validations/account.validation";
export type SafeUser = AccountUserProfile;

const getTodayStart = (): Date => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const getUserDownloadCounts = async (
  userId: string
): Promise<Pick<SafeUser, "download_today_count" | "download_total_count">> => {
  const today = getTodayStart();
  const [todayCounts, totalCounts] = await Promise.all([
    DownloadLogService.countDownloadsByUsers([userId], today),
    DownloadLogService.countDownloadsByUsers([userId]),
  ]);

  return {
    download_today_count: todayCounts[userId] ?? 0,
    download_total_count: totalCounts[userId] ?? 0,
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

    const downloadCounts = await getUserDownloadCounts(userId);
    return toAccountUserProfile(user, user.socialLinks, downloadCounts);
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
      const existingIds = new Set(
        existingLinks.map((link: { id: string }) => link.id)
      );
      const invalidIds = socialLinkIds.filter((id) => !existingIds.has(id));
      if (invalidIds.length > 0) {
        throw new ResponseError(400, "Social link tidak ditemukan");
      }
    }

    let movedAvatarPath: string | undefined;
    if (requestData.avatar !== undefined) {
      if (requestData.avatar && UploadService.isTempUploadPath(requestData.avatar)) {
        try {
          movedAvatarPath = await UploadService.moveFromTemp(
            "avatars",
            requestData.avatar
          );
          updateData.avatar = movedAvatarPath;
        } catch (error) {
          throw new ResponseError(400, "Gagal memindahkan avatar");
        }
      } else {
        updateData.avatar = requestData.avatar;
      }
    }

    updateData.updatedAt = new Date();

    try {
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

      if (
        requestData.avatar !== undefined &&
        existingUser.avatar &&
        existingUser.avatar !== user.avatar
      ) {
        await UploadService.deleteUpload(existingUser.avatar, [
          "uploads/avatars",
        ]);
      }

      const socialLinks = await prisma.userSocialLink.findMany({
        where: { userId },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      const downloadCounts = await getUserDownloadCounts(userId);
      return toAccountUserProfile(user, socialLinks, downloadCounts);
    } catch (error) {
      if (movedAvatarPath) {
        await UploadService.deleteUpload(movedAvatarPath, ["uploads/avatars"]);
      }
      throw error;
    }
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
    const passwordUpdatedAt = new Date();

    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        passwordResetTokenId: null,
        sessionInvalidBefore: passwordUpdatedAt,
        updatedAt: passwordUpdatedAt,
      },
    });
  }
}
