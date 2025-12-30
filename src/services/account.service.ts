import type { User } from "../generated/prisma/client";
import bcrypt from "bcrypt";
import { prisma } from "../config/prisma.config";
import { ChangePasswordRequest, UpdateMeRequest } from "../types/api-schemas";
import { ResponseError } from "../utils/response-error.util";
import { UploadService } from "../services/upload.service";
import { validate } from "../utils/validate.util";
import { AccountValidation } from "../validations/account.validation";

export type SafeUser = Omit<User, "password" | "createdAt" | "updatedAt"> & {
  created_at: Date;
  updated_at: Date;
};

const toSafeUser = (user: User): SafeUser => {
  const { password: _password, createdAt, updatedAt, ...rest } = user;
  return {
    ...rest,
    created_at: createdAt,
    updated_at: updatedAt,
  };
};

export class AccountService {
  static async me(userId: string): Promise<SafeUser> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new ResponseError(401, "Tidak terautentikasi");
    }

    return toSafeUser(user);
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

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return toSafeUser(user);
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
