import { randomBytes } from "crypto";
import type { User } from "../generated/prisma/client";
import bcrypt from "bcrypt";
import jwt, { JwtPayload } from "jsonwebtoken";
import env from "../config/env.config";
import { prisma } from "../config/prisma.config";
import {
  ChangePasswordRequest,
  ForgotPasswordRequest,
  GoogleLoginRequest,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  UpdateMeRequest,
} from "../types/api-schemas";
import { ResponseError } from "../utils/response-error.util";
import { validate } from "../utils/validate.util";
import { AuthValidation } from "../validations/auth.validation";
import { enqueueEmail } from "../queues/email.queue";
import { OAuth2Client, TokenPayload } from "google-auth-library";

export type SafeUser = Omit<User, "password">;

const toSafeUser = (user: User): SafeUser => {
  const { password: _password, ...safeUser } = user;
  return safeUser;
};

const googleOAuthClient = new OAuth2Client(
  env.googleClientId,
  env.googleClientSecret
);

interface LoginResult {
  token: string;
  user: SafeUser;
  expiresAt?: number;
}

export class AuthService {
  static async register(request: RegisterRequest): Promise<SafeUser> {
    const requestData = validate(AuthValidation.REGISTER, request);

    const totalUserWithSameEmail = await prisma.user.count({
      where: {
        email: requestData.email,
      },
    });

    if (totalUserWithSameEmail > 0) {
      throw new ResponseError(400, "Email sudah terdaftar");
    }

    const totalUserWithSameUsername = await prisma.user.count({
      where: {
        username: requestData.username,
      },
    });

    if (totalUserWithSameUsername > 0) {
      throw new ResponseError(400, "Username sudah terdaftar");
    }

    requestData.password = await bcrypt.hash(requestData.password, 10);

    const user = await prisma.user.create({
      data: {
        ...requestData,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return toSafeUser(user);
  }

  static async login(
    request: LoginRequest
  ): Promise<LoginResult | { requiresOtp: boolean; message: string }> {
    const requestData = validate(AuthValidation.LOGIN, request);
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          {
            email: requestData.identifier,
          },
          {
            username: requestData.identifier,
          },
        ],
      },
    });

    if (!user) {
      throw new ResponseError(404, "Pengguna tidak ditemukan");
    }

    const isPasswordValid = await bcrypt.compare(
      requestData.password,
      user.password
    );

    if (!isPasswordValid) {
      throw new ResponseError(401, "Kata sandi salah");
    }

    // If OTP is enabled, send OTP and return different response
    if (env.otp.enabled) {
      // Import OtpService to send OTP
      const { OtpService } = await import("./otp.service");

      // Generate and send OTP
      await OtpService.sendOtp({ identifier: requestData.identifier });

      return {
        requiresOtp: true,
        message:
          "OTP telah dikirim ke email Anda. Silakan verifikasi untuk menyelesaikan login.",
      };
    }

    // Normal login flow when OTP is disabled
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
      user: toSafeUser(user),
      expiresAt: decoded?.exp ? decoded.exp * 1000 : undefined,
    };
  }

  static async loginWithGoogle(
    request: GoogleLoginRequest
  ): Promise<LoginResult> {
    const requestData = validate(AuthValidation.GOOGLE_LOGIN, request);

    let payload: TokenPayload | undefined;

    try {
      const ticket = await googleOAuthClient.verifyIdToken({
        idToken: requestData.id_token,
        audience: env.googleClientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new ResponseError(401, "Token Google tidak valid");
    }

    if (!payload || !payload.sub || !payload.email) {
      throw new ResponseError(401, "Token Google tidak valid");
    }

    if (payload.email_verified === false) {
      throw new ResponseError(401, "Email Google belum diverifikasi");
    }

    const googleId = payload.sub;
    const email = payload.email;
    const avatar = payload.picture ?? null;
    const displayName =
      payload.name?.trim() ||
      payload.given_name?.trim() ||
      email.split("@")[0] ||
      "Google User";
    const name = displayName.length >= 3 ? displayName : "Google User";

    let user = await prisma.user.findFirst({
      where: {
        OR: [{ googleId }, { email }],
      },
    });

    if (!user) {
      const [emailLocalPart] = email.split("@");
      const username = await AuthService.generateUniqueUsername(
        emailLocalPart || name
      );
      const randomPassword = randomBytes(32).toString("hex");
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      user = await prisma.user.create({
        data: {
          name,
          username,
          email,
          password: hashedPassword,
          googleId,
          avatar,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    } else {
      const updateData: {
        googleId?: string;
        avatar?: string | null;
      } = {};

      if (!user.googleId) {
        updateData.googleId = googleId;
      }

      if (!user.avatar && avatar) {
        updateData.avatar = avatar;
      }

      if (Object.keys(updateData).length > 0) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: updateData,
        });
      }
    }

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
      user: toSafeUser(user),
      expiresAt: decoded?.exp ? decoded.exp * 1000 : undefined,
    };
  }

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
    const requestData = validate(AuthValidation.UPDATE_ME, request);

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
      updateData.avatar = requestData.avatar;
    }

    updateData.updatedAt = new Date();

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return toSafeUser(user);
  }

  static async sendPasswordResetLink(
    request: ForgotPasswordRequest
  ): Promise<void> {
    const requestData = validate(AuthValidation.FORGOT_PASSWORD, request);
    const email = requestData.email.toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return;
    }

    const token = jwt.sign(
      {
        sub: user.id,
        type: "password_reset",
      },
      env.jwtSecret,
      { expiresIn: env.passwordResetTokenExpiresIn }
    );

    const resetUrl = AuthService.buildPasswordResetUrl(token);
    const plainText = AuthService.buildPasswordResetText(resetUrl, token);

    await enqueueEmail({
      to: email,
      subject: "Instruksi Reset Kata Sandi",
      text: plainText,
      template: "password-reset",
      context: {
        name: user.name ?? user.email,
        resetUrl,
        token,
        supportEmail: env.mail.fromAddress,
      },
    });
  }

  static async resetPassword(request: ResetPasswordRequest): Promise<void> {
    const requestData = validate(AuthValidation.RESET_PASSWORD, request);

    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(requestData.token, env.jwtSecret) as JwtPayload;
    } catch {
      throw new ResponseError(
        400,
        "Token reset kata sandi tidak valid atau kadaluarsa"
      );
    }

    if (
      !decoded ||
      decoded.type !== "password_reset" ||
      typeof decoded.sub !== "string"
    ) {
      throw new ResponseError(400, "Token reset kata sandi tidak valid");
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
    });

    if (!user) {
      throw new ResponseError(400, "Token reset kata sandi tidak valid");
    }

    const hashedPassword = await bcrypt.hash(requestData.password, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        updatedAt: new Date(),
      },
    });
  }

  static async changePassword(
    userId: string,
    request: ChangePasswordRequest
  ): Promise<void> {
    const requestData = validate(AuthValidation.CHANGE_PASSWORD, request);
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
      where: { id: user.id },
      data: {
        password: hashedPassword,
        updatedAt: new Date(),
      },
    });
  }

  private static buildPasswordResetUrl(token: string): string | null {
    if (!env.passwordResetUrl) {
      return null;
    }

    const separator = env.passwordResetUrl.includes("?") ? "&" : "?";
    return `${env.passwordResetUrl}${separator}token=${encodeURIComponent(
      token
    )}`;
  }

  private static buildPasswordResetText(
    url: string | null,
    token: string
  ): string {
    if (url) {
      return `Kami menerima permintaan untuk reset kata sandi Anda. Klik link ini untuk melanjutkan: ${url}`;
    }

    return `Gunakan token berikut untuk reset kata sandi Anda: ${token}`;
  }

  private static normalizeUsernameSource(source?: string): string {
    const fallback = "user";
    if (!source) {
      return fallback;
    }

    const normalized = source
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 20);
    return normalized.length >= 3 ? normalized : fallback;
  }

  private static async generateUniqueUsername(
    source?: string
  ): Promise<string> {
    const base = AuthService.normalizeUsernameSource(source);
    let attempt = 0;

    while (attempt < 50) {
      const candidate = attempt === 0 ? base : `${base}${attempt}`;
      const exists = await prisma.user.count({
        where: { username: candidate },
      });
      if (exists === 0) {
        return candidate;
      }
      attempt += 1;
    }

    while (true) {
      const candidate = `${base}${randomBytes(2).toString("hex")}`;
      const exists = await prisma.user.count({
        where: { username: candidate },
      });
      if (exists === 0) {
        return candidate;
      }
    }
  }
}
