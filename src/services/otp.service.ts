import { randomInt } from "crypto";
import type { User } from "../generated/prisma/client";
import bcrypt from "bcrypt";
import env from "../config/env.config";
import { prisma } from "../config/prisma.config";
import { ResponseError } from "../utils/response-error.util";
import { validate } from "../utils/validate.util";
import { AuthValidation } from "../validations/auth.validation";
import { enqueueEmail } from "../queues/email.queue";
import { DocumentService } from "./document.service";
import { ensureAccountIsActive } from "../utils/account-status.util";
import { createSessionToken } from "../utils/session-auth.util";

const DUMMY_PASSWORD_HASH =
  "$2b$10$13onwnyV1sH9fqfH6hS50ea8wzaWOXTmymKpB84EPCYxZ8mO2NkFe";
const INVALID_OTP_LOGIN_MESSAGE = "Kredensial login atau OTP tidak valid";

export class OtpService {
  private static assertOtpEnabled(): void {
    if (!env.otp.enabled) {
      throw new ResponseError(503, "Fitur OTP sedang dinonaktifkan");
    }
  }

  private static getOtpExpiresInSeconds(): number {
    return env.otp.expiresInSeconds;
  }

  private static getOtpResendCooldownSeconds(): number {
    return env.otp.resendCooldownInSeconds;
  }

  static async generateOtpCode(): Promise<string> {
    // Generate a 6-digit OTP code
    return randomInt(100000, 1000000).toString();
  }

  static async sendOtp(request: { identifier: string; user?: User }): Promise<{
    message: string;
    expires_at: number;
    expires_in: number;
    resend_available_at: number;
  }> {
    OtpService.assertOtpEnabled();

    const requestData = validate(AuthValidation.SEND_OTP, request);

    // Find user by email or username
    const user =
      request.user ??
      (await prisma.user.findFirst({
        where: {
          OR: [
            { email: requestData.identifier },
            { username: requestData.identifier },
          ],
        },
      }));

    if (!user) {
      throw new ResponseError(401, INVALID_OTP_LOGIN_MESSAGE);
    }

    // Generate OTP code
    const otpCode = await OtpService.generateOtpCode();

    // Calculate expiry time (default 5 minutes from config)
    const expiresAt = new Date();
    expiresAt.setSeconds(
      expiresAt.getSeconds() + OtpService.getOtpExpiresInSeconds()
    );

    // Delete any existing OTP codes for this user
    await prisma.otp.deleteMany({
      where: {
        userId: user.id,
      },
    });

    // Store new OTP
    await prisma.otp.create({
      data: {
        userId: user.id,
        code: otpCode,
        purpose: "login_verification",
        expiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Send OTP via email
    await enqueueEmail({
      to: user.email,
      subject: "Kode OTP untuk Verifikasi Login",
      text: `Kode OTP Anda adalah: ${otpCode}. Kode ini akan kadaluarsa dalam ${OtpService.getOtpExpiresInSeconds()} detik.`,
      template: "otp",
      context: {
        name: user.name ?? user.email,
        otpCode,
        supportEmail: env.mail.fromAddress,
        appBaseUrl: env.appBaseUrl,
      },
    });

    // Calculate when user can request a new OTP (using cooldown time)
    const now = new Date();
    const resendAvailableAt = new Date(
      now.getTime() + OtpService.getOtpResendCooldownSeconds() * 1000
    );

    return {
      message: "OTP telah dikirim ke email Anda",
      expires_at: expiresAt.getTime(),
      expires_in: OtpService.getOtpExpiresInSeconds(),
      resend_available_at: resendAvailableAt.getTime(),
    };
  }

  static async verifyOtp(request: {
    identifier: string;
    otp_code: string;
    password: string;
  }): Promise<{ token: string; user: any; expires_at?: number }> {
    OtpService.assertOtpEnabled();

    const requestData = validate(AuthValidation.VERIFY_OTP, request);

    // Find user by email or username
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: requestData.identifier },
          { username: requestData.identifier },
        ],
      },
    });

    const passwordHash = user?.password ?? DUMMY_PASSWORD_HASH;
    const isPasswordValid = await bcrypt.compare(
      requestData.password,
      passwordHash
    );
    if (!user || !isPasswordValid) {
      throw new ResponseError(401, INVALID_OTP_LOGIN_MESSAGE);
    }

    // Find valid OTP for this user
    const otp = await prisma.otp.findFirst({
      where: {
        userId: user.id,
        code: requestData.otp_code,
        purpose: "login_verification",
        expiresAt: {
          gt: new Date(), // OTP must not be expired
        },
      },
    });

    if (!otp) {
      throw new ResponseError(401, INVALID_OTP_LOGIN_MESSAGE);
    }

    // Delete the used OTP
    await prisma.otp.delete({
      where: {
        id: otp.id,
      },
    });

    // Update user emailVerifiedAt if not set
    if (!user.emailVerifiedAt) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerifiedAt: new Date(),
        },
      });
    }

    ensureAccountIsActive(user);

    // Generate JWT token
    const { token, expires_at } = createSessionToken(user);
    const storageStats = await DocumentService.getStorageStats(user.id);

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatar: user.avatar,
        created_at: user.createdAt,
        updated_at: user.updatedAt,
        document_storage_stats: storageStats,
      },
      expires_at,
    };
  }

  static async resendOtp(request: { identifier: string }): Promise<{
    message: string;
    expires_at: number;
    expires_in: number;
    resend_available_at: number;
  }> {
    OtpService.assertOtpEnabled();

    const requestData = validate(AuthValidation.RESEND_OTP, request);

    // Find user by email or username
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: requestData.identifier },
          { username: requestData.identifier },
        ],
      },
    });

    if (!user) {
      const now = Date.now();
      const expiresIn = OtpService.getOtpExpiresInSeconds();
      const resendCooldown = OtpService.getOtpResendCooldownSeconds();

      return {
        message: "OTP telah dikirim ulang ke email Anda",
        expires_at: now + expiresIn * 1000,
        expires_in: expiresIn,
        resend_available_at: now + resendCooldown * 1000,
      };
    }

    // Check if there's an existing OTP that's still valid
    const existingOtp = await prisma.otp.findFirst({
      where: {
        userId: user.id,
        purpose: "login_verification",
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (existingOtp && existingOtp.expiresAt) {
      // Check if the resend cooldown has passed
      const now = Date.now();
      const otpCreatedAt = existingOtp.createdAt?.getTime() || now;
      const timeSinceCreation = now - otpCreatedAt;

      const cooldownSeconds = OtpService.getOtpResendCooldownSeconds();
      if (timeSinceCreation < cooldownSeconds * 1000) {
        const remainingCooldown = Math.ceil(
          (cooldownSeconds * 1000 - timeSinceCreation) / 1000
        );

        throw new ResponseError(
          429,
          "OTP sudah dikirim. Silakan tunggu sebelum meminta yang baru.",
          {
            remaining_time: [remainingCooldown.toString()],
            resend_available_at: [
              String(otpCreatedAt + cooldownSeconds * 1000),
            ],
          }
        );
      }
    }

    // Delete any existing OTP codes for this user
    await prisma.otp.deleteMany({
      where: {
        userId: user.id,
      },
    });

    // Generate new OTP code
    const otpCode = await OtpService.generateOtpCode();

    // Calculate expiry time
    const expiresAt = new Date();
    expiresAt.setSeconds(
      expiresAt.getSeconds() + OtpService.getOtpExpiresInSeconds()
    );

    // Store new OTP
    await prisma.otp.create({
      data: {
        userId: user.id,
        code: otpCode,
        purpose: "login_verification",
        expiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Send OTP via email
    await enqueueEmail({
      to: user.email,
      subject: "Kode OTP untuk Verifikasi Login",
      text: `Kode OTP Anda adalah: ${otpCode}. Kode ini akan kadaluarsa dalam ${OtpService.getOtpExpiresInSeconds()} detik.`,
      template: "otp",
      context: {
        name: user.name ?? user.email,
        otpCode,
        supportEmail: env.mail.fromAddress,
        appBaseUrl: env.appBaseUrl,
      },
    });

    // Calculate when user can request a new OTP (using cooldown time)
    const now = new Date();
    const resendAvailableAt = new Date(
      now.getTime() + OtpService.getOtpResendCooldownSeconds() * 1000
    );

    return {
      message: "OTP telah dikirim ulang ke email Anda",
      expires_at: expiresAt.getTime(),
      expires_in: OtpService.getOtpExpiresInSeconds(),
      resend_available_at: resendAvailableAt.getTime(),
    };
  }

  static async checkOtpStatus(request: { identifier: string }): Promise<{
    has_active_otp: boolean;
    expires_at?: number;
    expires_in?: number;
    resend_available_at?: number;
  }> {
    OtpService.assertOtpEnabled();

    const requestData = validate(AuthValidation.CHECK_OTP_STATUS, request);

    // Find user by email or username
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: requestData.identifier },
          { username: requestData.identifier },
        ],
      },
    });

    if (!user) {
      return {
        has_active_otp: false,
      };
    }

    // Check if there's an active OTP for this user
    const activeOtp = await prisma.otp.findFirst({
      where: {
        userId: user.id,
        purpose: "login_verification",
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!activeOtp) {
      return {
        has_active_otp: false,
      };
    }

    const now = Date.now();
    const expiresAt = activeOtp.expiresAt?.getTime() || 0;
    const expiresIn = Math.ceil((expiresAt - now) / 1000);

    return {
      has_active_otp: true,
      expires_at: expiresAt,
      expires_in: expiresIn,
      resend_available_at: activeOtp.createdAt
        ? activeOtp.createdAt.getTime() +
          OtpService.getOtpResendCooldownSeconds() * 1000
        : expiresAt,
    };
  }

  static async cleanupExpiredOtps(): Promise<void> {
    // This method can be called periodically to clean up expired OTPs
    await prisma.otp.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
  }
}
