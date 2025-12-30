import { randomBytes, randomInt } from "crypto";
import type { User, Otp, PrismaClient } from "../generated/prisma/client";
import bcrypt from "bcrypt";
import jwt, { JwtPayload } from "jsonwebtoken";
import env from "../config/env.config";
import { prisma } from "../config/prisma.config";
import { ResponseError } from "../utils/response-error.util";
import { validate } from "../utils/validate.util";
import { AuthValidation } from "../validations/auth.validation";
import { enqueueEmail } from "../queues/email.queue";

export class OtpService {
  static async generateOtpCode(): Promise<string> {
    // Generate a 6-digit OTP code
    return randomInt(100000, 1000000).toString();
  }

  static async sendOtp(request: { identifier: string }): Promise<{
    message: string;
    expires_at: number;
    expires_in: number;
    resend_available_at: number;
  }> {
    const requestData = validate(AuthValidation.SEND_OTP, request);

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
      throw new ResponseError(404, "Pengguna tidak ditemukan");
    }

    // Generate OTP code
    const otpCode = await OtpService.generateOtpCode();

    // Calculate expiry time (default 5 minutes from config)
    const expiresAt = new Date();
    expiresAt.setMinutes(
      expiresAt.getMinutes() + env.otp.expiresInSeconds / 60
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
      text: `Kode OTP Anda adalah: ${otpCode}. Kode ini akan kadaluarsa dalam 5 menit.`,
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
      now.getTime() + env.otp.resendCooldownInSeconds * 1000
    );

    return {
      message: "OTP telah dikirim ke email Anda",
      expires_at: expiresAt.getTime(),
      expires_in: env.otp.expiresInSeconds,
      resend_available_at: resendAvailableAt.getTime(),
    };
  }

  static async verifyOtp(request: {
    identifier: string;
    otp_code: string;
    password: string;
  }): Promise<{ token: string; user: any; expires_at?: number }> {
    const requestData = validate(AuthValidation.VERIFY_OTP, request);

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
      throw new ResponseError(404, "Pengguna tidak ditemukan");
    }

    // Verify password (still needed for security)
    const isPasswordValid = await bcrypt.compare(
      requestData.password,
      user.password
    );
    if (!isPasswordValid) {
      throw new ResponseError(401, "Kata sandi salah");
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
      throw new ResponseError(401, "Kode OTP tidak valid atau kadaluarsa");
    }

    // Delete the used OTP
    await prisma.otp.delete({
      where: {
        id: otp.id,
      },
    });

    // Generate JWT token
    const token = jwt.sign(
      {
        sub: user.id,
        username: user.username,
        email: user.email,
      },
      env.jwtSecret,
      { expiresIn: env.jwtExpiresIn }
    );

    const decoded = jwt.decode(token) as JwtPayload | null;

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
      },
      expires_at: decoded?.exp ? decoded.exp * 1000 : undefined,
    };
  }

  static async resendOtp(request: { identifier: string }): Promise<{
    message: string;
    expires_at: number;
    expires_in: number;
    resend_available_at: number;
  }> {
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
      throw new ResponseError(404, "Pengguna tidak ditemukan");
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

      if (timeSinceCreation < env.otp.resendCooldownInSeconds * 1000) {
        const remainingCooldown = Math.ceil(
          (env.otp.resendCooldownInSeconds * 1000 - timeSinceCreation) / 1000
        );

        throw new ResponseError(
          429,
          "OTP sudah dikirim. Silakan tunggu sebelum meminta yang baru.",
          {
            remaining_time: [remainingCooldown.toString()],
            resend_available_at: [
              String(otpCreatedAt + env.otp.resendCooldownInSeconds * 1000),
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
    expiresAt.setMinutes(
      expiresAt.getMinutes() + env.otp.expiresInSeconds / 60
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
      text: `Kode OTP Anda adalah: ${otpCode}. Kode ini akan kadaluarsa dalam 5 menit.`,
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
      now.getTime() + env.otp.resendCooldownInSeconds * 1000
    );

    return {
      message: "OTP telah dikirim ulang ke email Anda",
      expires_at: expiresAt.getTime(),
      expires_in: env.otp.expiresInSeconds,
      resend_available_at: resendAvailableAt.getTime(),
    };
  }

  static async checkOtpStatus(request: { identifier: string }): Promise<{
    has_active_otp: boolean;
    expires_at?: number;
    expires_in?: number;
    resend_available_at?: number;
  }> {
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
      throw new ResponseError(404, "Pengguna tidak ditemukan");
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
        ? activeOtp.createdAt.getTime() + env.otp.resendCooldownInSeconds * 1000
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
