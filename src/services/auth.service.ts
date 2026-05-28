import { createPublicKey, randomBytes } from "crypto";
import type { User } from "../generated/prisma/client";
import bcrypt from "bcrypt";
import jwt, { JwtPayload } from "jsonwebtoken";
import env from "../config/env.config";
import { prisma } from "../config/prisma.config";
import {
  AppleLoginRequest,
  FacebookLoginRequest,
  ForgotPasswordRequest,
  GoogleLoginRequest,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
} from "../types/api-schemas";
import { ResponseError } from "../utils/response-error.util";
import { ensureAccountIsActive } from "../utils/account-status.util";
import { toSafeUser, SafeUser } from "../utils/user.util";
import { validate } from "../utils/validate.util";
import { AuthValidation } from "../validations/auth.validation";
import { enqueueEmail } from "../queues/email.queue";
import { OAuth2Client, TokenPayload } from "google-auth-library";
import {
  DocumentService,
  type DocumentStorageStats,
} from "./document.service";
import { createSessionToken } from "../utils/session-auth.util";
import { markUserLastLogin } from "../utils/user-login.util";
import { buildUserSubscriptionState } from "../config/subscription-plans.config";

const googleOAuthClient = new OAuth2Client(
  env.googleClientId,
  env.googleClientSecret
);

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_KEYS_URL = `${APPLE_ISSUER}/auth/keys`;

type AuthUser = SafeUser & {
  document_storage_stats: DocumentStorageStats;
};

interface LoginResult {
  token: string;
  user: AuthUser;
  expires_at?: number;
}

interface OtpLoginResult {
  requires_otp: boolean;
  message: string;
  expires_at?: number;
  expires_in?: number;
  resend_available_at?: number;
}

interface FacebookDebugTokenResponse {
  data?: {
    app_id?: string;
    is_valid?: boolean;
    user_id?: string;
  };
}

interface FacebookProfileResponse {
  id?: string;
  name?: string;
  email?: string;
  picture?: {
    data?: {
      url?: string;
    };
  };
}

interface AppleJwk {
  [key: string]: string | undefined;
  kty: string;
  kid: string;
  use?: string;
  alg?: string;
  n: string;
  e: string;
}

interface AppleKeysResponse {
  keys?: AppleJwk[];
}

const DUMMY_PASSWORD_HASH =
  "$2b$10$13onwnyV1sH9fqfH6hS50ea8wzaWOXTmymKpB84EPCYxZ8mO2NkFe";
const INVALID_LOGIN_MESSAGE = "Email, username, atau kata sandi salah";

export class AuthService {
  static async register(request: RegisterRequest): Promise<AuthUser> {
    const requestData = validate(AuthValidation.REGISTER, request);
    const emailLocalPart = requestData.email.split("@")[0];
    const username = requestData.username
      ? requestData.username
      : await AuthService.generateUniqueUsername(
          emailLocalPart || requestData.name
        );

    const totalUserWithSameEmail = await prisma.user.count({
      where: {
        email: requestData.email,
      },
    });

    if (totalUserWithSameEmail > 0) {
      throw new ResponseError(400, "Email sudah terdaftar");
    }

    if (requestData.username) {
      const totalUserWithSameUsername = await prisma.user.count({
        where: {
          username: requestData.username,
        },
      });

      if (totalUserWithSameUsername > 0) {
        throw new ResponseError(400, "Username sudah terdaftar");
      }
    }

    requestData.password = await bcrypt.hash(requestData.password, 10);
    const freePlan = buildUserSubscriptionState("free");

    const user = await prisma.user.create({
      data: {
        ...requestData,
        username,
        subscriptionPlan: freePlan.subscriptionPlan,
        subscriptionExpiresAt: freePlan.subscriptionExpiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const storageStats = await DocumentService.getStorageStats(user.id);
    return {
      ...toSafeUser(user),
      document_storage_stats: storageStats,
    };
  }

  static async login(
    request: LoginRequest
  ): Promise<LoginResult | OtpLoginResult> {
    const requestData = validate(AuthValidation.LOGIN, request);
    let user = await prisma.user.findFirst({
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
      await bcrypt.compare(requestData.password, DUMMY_PASSWORD_HASH);
      throw new ResponseError(401, INVALID_LOGIN_MESSAGE);
    }

    const isPasswordValid = await bcrypt.compare(
      requestData.password,
      user.password
    );

    if (!isPasswordValid) {
      throw new ResponseError(401, INVALID_LOGIN_MESSAGE);
    }

    ensureAccountIsActive(user);

    // If OTP is enabled, send OTP and return different response
    if (env.otp.enabled) {
      // Import OtpService to send OTP
      const { OtpService } = await import("./otp.service");

      // Generate and send OTP
      const otpResult = await OtpService.sendOtp({
        identifier: requestData.identifier,
        user,
      });

      return {
        requires_otp: true,
        message:
          "OTP telah dikirim ke email Anda. Silakan verifikasi untuk menyelesaikan login.",
        expires_at: otpResult.expires_at,
        expires_in: otpResult.expires_in,
        resend_available_at: otpResult.resend_available_at,
      };
    }

    // Normal login flow when OTP is disabled
    user = await markUserLastLogin(user.id);
    const { token, expires_at } = createSessionToken(user);

    return {
      token,
      user: {
        ...toSafeUser(user),
        document_storage_stats:
          await DocumentService.getStorageStats(user.id),
      },
      expires_at,
    };
  }

  static async loginWithGoogle(
    request: GoogleLoginRequest
  ): Promise<LoginResult> {
    if (!env.googleOAuthEnabled) {
      throw new ResponseError(
        503,
        "Fitur login dengan Google sedang dinonaktifkan"
      );
    }

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
      const freePlan = buildUserSubscriptionState("free");

      user = await prisma.user.create({
        data: {
          name,
          username,
          email,
          password: hashedPassword,
          googleId,
          avatar,
          subscriptionPlan: freePlan.subscriptionPlan,
          subscriptionExpiresAt: freePlan.subscriptionExpiresAt,
          emailVerifiedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    } else {
      const updateData: {
        googleId?: string;
        avatar?: string | null;
        emailVerifiedAt?: Date;
      } = {};

      if (!user.googleId) {
        updateData.googleId = googleId;
      }

      if (!user.avatar && avatar) {
        updateData.avatar = avatar;
      }

      if (!user.emailVerifiedAt) {
        updateData.emailVerifiedAt = new Date();
      }

      if (Object.keys(updateData).length > 0) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: updateData,
        });
      }
    }

    ensureAccountIsActive(user);

    user = await markUserLastLogin(user.id);
    const { token, expires_at } = createSessionToken(user);

    return {
      token,
      user: {
        ...toSafeUser(user),
        document_storage_stats:
          await DocumentService.getStorageStats(user.id),
      },
      expires_at,
    };
  }

  static async loginWithFacebook(
    request: FacebookLoginRequest
  ): Promise<LoginResult> {
    if (!env.facebookOAuthEnabled) {
      throw new ResponseError(
        503,
        "Fitur login dengan Facebook sedang dinonaktifkan"
      );
    }

    if (!env.facebookClientId || !env.facebookClientSecret) {
      throw new ResponseError(503, "Konfigurasi Facebook OAuth belum lengkap");
    }

    const requestData = validate(AuthValidation.FACEBOOK_LOGIN, request);
    const profile = await AuthService.verifyFacebookAccessToken(
      requestData.access_token
    );
    const facebookId = profile.id;
    const email = profile.email;

    if (!facebookId || !email) {
      throw new ResponseError(401, "Token Facebook tidak valid");
    }

    const avatar = profile.picture?.data?.url ?? null;
    const displayName =
      profile.name?.trim() || email.split("@")[0] || "Facebook User";
    const name = displayName.length >= 3 ? displayName : "Facebook User";

    let user = await prisma.user.findFirst({
      where: {
        OR: [{ facebookId }, { email }],
      },
    });

    if (!user) {
      const [emailLocalPart] = email.split("@");
      const username = await AuthService.generateUniqueUsername(
        emailLocalPart || name
      );
      const randomPassword = randomBytes(32).toString("hex");
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      const freePlan = buildUserSubscriptionState("free");

      user = await prisma.user.create({
        data: {
          name,
          username,
          email,
          password: hashedPassword,
          facebookId,
          avatar,
          subscriptionPlan: freePlan.subscriptionPlan,
          subscriptionExpiresAt: freePlan.subscriptionExpiresAt,
          emailVerifiedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    } else {
      const updateData: {
        facebookId?: string;
        avatar?: string | null;
        emailVerifiedAt?: Date;
      } = {};

      if (!user.facebookId) {
        updateData.facebookId = facebookId;
      }

      if (!user.avatar && avatar) {
        updateData.avatar = avatar;
      }

      if (!user.emailVerifiedAt) {
        updateData.emailVerifiedAt = new Date();
      }

      if (Object.keys(updateData).length > 0) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: updateData,
        });
      }
    }

    ensureAccountIsActive(user);

    user = await markUserLastLogin(user.id);
    const { token, expires_at } = createSessionToken(user);

    return {
      token,
      user: {
        ...toSafeUser(user),
        document_storage_stats:
          await DocumentService.getStorageStats(user.id),
      },
      expires_at,
    };
  }

  static async loginWithApple(
    request: AppleLoginRequest
  ): Promise<LoginResult> {
    if (!env.appleOAuthEnabled) {
      throw new ResponseError(
        503,
        "Fitur login dengan Apple sedang dinonaktifkan"
      );
    }

    if (!env.appleClientId) {
      throw new ResponseError(503, "Konfigurasi Apple OAuth belum lengkap");
    }

    const requestData = validate(AuthValidation.APPLE_LOGIN, request);
    const payload = await AuthService.verifyAppleIdToken(requestData.id_token);
    const appleId = typeof payload.sub === "string" ? payload.sub : undefined;
    const email = typeof payload.email === "string" ? payload.email : undefined;
    const emailVerified =
      payload.email_verified === true || payload.email_verified === "true";

    if (!appleId) {
      throw new ResponseError(401, "Token Apple tidak valid");
    }

    if (email && !emailVerified) {
      throw new ResponseError(401, "Email Apple belum diverifikasi");
    }

    let user = await prisma.user.findFirst({
      where: {
        OR: email ? [{ appleId }, { email }] : [{ appleId }],
      },
    });

    if (!user) {
      if (!email) {
        throw new ResponseError(401, "Email Apple tidak tersedia");
      }

      const displayName =
        requestData.name?.trim() || email.split("@")[0] || "Apple User";
      const name = displayName.length >= 3 ? displayName : "Apple User";
      const [emailLocalPart] = email.split("@");
      const username = await AuthService.generateUniqueUsername(
        emailLocalPart || name
      );
      const randomPassword = randomBytes(32).toString("hex");
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      const freePlan = buildUserSubscriptionState("free");

      user = await prisma.user.create({
        data: {
          name,
          username,
          email,
          password: hashedPassword,
          appleId,
          subscriptionPlan: freePlan.subscriptionPlan,
          subscriptionExpiresAt: freePlan.subscriptionExpiresAt,
          emailVerifiedAt: emailVerified ? new Date() : undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    } else {
      const updateData: {
        appleId?: string;
        emailVerifiedAt?: Date;
      } = {};

      if (!user.appleId) {
        updateData.appleId = appleId;
      }

      if (!user.emailVerifiedAt && emailVerified) {
        updateData.emailVerifiedAt = new Date();
      }

      if (Object.keys(updateData).length > 0) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: updateData,
        });
      }
    }

    ensureAccountIsActive(user);

    user = await markUserLastLogin(user.id);
    const { token, expires_at } = createSessionToken(user);

    return {
      token,
      user: {
        ...toSafeUser(user),
        document_storage_stats:
          await DocumentService.getStorageStats(user.id),
      },
      expires_at,
    };
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

    const passwordResetTokenId = randomBytes(16).toString("hex");

    const token = jwt.sign(
      {
        sub: user.id,
        type: "password_reset",
        jti: passwordResetTokenId,
      },
      env.jwtSecret,
      { expiresIn: env.passwordResetTokenExpiresIn }
    );

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenId,
        updatedAt: new Date(),
      },
    });

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
        appBaseUrl: env.appBaseUrl,
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
      typeof decoded.sub !== "string" ||
      typeof decoded.jti !== "string"
    ) {
      throw new ResponseError(400, "Token reset kata sandi tidak valid");
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
    });

    if (!user || user.passwordResetTokenId !== decoded.jti) {
      throw new ResponseError(400, "Token reset kata sandi tidak valid");
    }

    const hashedPassword = await bcrypt.hash(requestData.password, 10);
    const passwordUpdatedAt = new Date();

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetTokenId: null,
        sessionInvalidBefore: passwordUpdatedAt,
        updatedAt: passwordUpdatedAt,
      },
    });
  }

  private static async verifyFacebookAccessToken(
    accessToken: string
  ): Promise<FacebookProfileResponse> {
    const appAccessToken = `${env.facebookClientId}|${env.facebookClientSecret}`;
    const debugUrl = new URL("https://graph.facebook.com/debug_token");
    debugUrl.searchParams.set("input_token", accessToken);
    debugUrl.searchParams.set("access_token", appAccessToken);

    const debugResponse =
      await AuthService.fetchJson<FacebookDebugTokenResponse>(
        debugUrl,
        "Token Facebook tidak valid"
      );

    if (
      !debugResponse.data?.is_valid ||
      debugResponse.data.app_id !== env.facebookClientId ||
      !debugResponse.data.user_id
    ) {
      throw new ResponseError(401, "Token Facebook tidak valid");
    }

    const profileUrl = new URL("https://graph.facebook.com/me");
    profileUrl.searchParams.set("fields", "id,name,email,picture.type(large)");
    profileUrl.searchParams.set("access_token", accessToken);

    const profile = await AuthService.fetchJson<FacebookProfileResponse>(
      profileUrl,
      "Token Facebook tidak valid"
    );

    if (profile.id !== debugResponse.data.user_id) {
      throw new ResponseError(401, "Token Facebook tidak valid");
    }

    return profile;
  }

  private static async verifyAppleIdToken(idToken: string): Promise<JwtPayload> {
    const decoded = jwt.decode(idToken, { complete: true });

    if (
      !decoded ||
      typeof decoded === "string" ||
      decoded.header.alg !== "RS256" ||
      typeof decoded.header.kid !== "string"
    ) {
      throw new ResponseError(401, "Token Apple tidak valid");
    }

    const keysResponse = await AuthService.fetchJson<AppleKeysResponse>(
      new URL(APPLE_KEYS_URL),
      "Token Apple tidak valid"
    );
    const key = keysResponse.keys?.find(
      (candidate) => candidate.kid === decoded.header.kid
    );

    if (!key) {
      throw new ResponseError(401, "Token Apple tidak valid");
    }

    try {
      const publicKey = createPublicKey({ key, format: "jwk" });
      const payload = jwt.verify(idToken, publicKey, {
        algorithms: ["RS256"],
        audience: env.appleClientId,
        issuer: APPLE_ISSUER,
      });

      if (!payload || typeof payload === "string") {
        throw new ResponseError(401, "Token Apple tidak valid");
      }

      return payload;
    } catch (error) {
      if (error instanceof ResponseError) {
        throw error;
      }

      throw new ResponseError(401, "Token Apple tidak valid");
    }
  }

  private static async fetchJson<T>(
    url: URL,
    errorMessage: string
  ): Promise<T> {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new ResponseError(401, errorMessage);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ResponseError) {
        throw error;
      }

      throw new ResponseError(401, errorMessage);
    }
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
