import { NextFunction, Request, Response } from "express";
import env from "../config/env.config";
import { AuthService } from "../services/auth.service";
import {
  ForgotPasswordRequest,
  GoogleLoginRequest,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
} from "../types/api-schemas";
import { sendError, sendSuccess } from "../utils/response-builder.util";
import { OtpService } from "../services/otp.service";

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await AuthService.register(req.body as RegisterRequest);

      sendSuccess(res, user, 201);
    } catch (error) {
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.login(req.body as LoginRequest);

      // Check if OTP is required
      if ("requiresOtp" in result && result.requiresOtp) {
        sendSuccess(res, {
          message: result.message,
          requires_otp: true,
          expiresAt: result.expiresAt,
          expiresIn: result.expiresIn,
          resendAvailableAt: result.resendAvailableAt,
        });
        return;
      }

      // Normal login flow
      const { token, user, expiresAt } = result as {
        token: string;
        user: any;
        expiresAt?: number;
      };

      const maxAge =
        typeof expiresAt === "number"
          ? Math.max(expiresAt - Date.now(), 0)
          : 24 * 60 * 60 * 1000;

      res.cookie(env.sessionCookieName, token, {
        httpOnly: true,
        secure: env.nodeEnv === "production",
        sameSite: env.nodeEnv === "production" ? "none" : "lax",
        maxAge,
      });

      sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  }

  static async loginWithGoogle(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { token, user, expiresAt } = await AuthService.loginWithGoogle(
        req.body as GoogleLoginRequest
      );

      const maxAge =
        typeof expiresAt === "number"
          ? Math.max(expiresAt - Date.now(), 0)
          : 24 * 60 * 60 * 1000;

      res.cookie(env.sessionCookieName, token, {
        httpOnly: true,
        secure: env.nodeEnv === "production",
        sameSite: env.nodeEnv === "production" ? "none" : "lax",
        maxAge,
      });

      sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  }

  static async logout(_req: Request, res: Response, next: NextFunction) {
    try {
      res.clearCookie(env.sessionCookieName, {
        httpOnly: true,
        secure: env.nodeEnv === "production",
        sameSite: env.nodeEnv === "production" ? "none" : "lax",
      });

      sendSuccess(res);
    } catch (error) {
      next(error);
    }
  }

  static async sendPasswordResetLink(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      await AuthService.sendPasswordResetLink(
        req.body as ForgotPasswordRequest
      );

      sendSuccess(res, {
        message: "If the email exists, reset instructions have been sent",
      });
    } catch (error) {
      next(error);
    }
  }

  static async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      await AuthService.resetPassword(req.body as ResetPasswordRequest);

      sendSuccess(res, {
        message: "Password has been reset",
      });
    } catch (error) {
      next(error);
    }
  }

  static async verifyOtp(req: Request, res: Response) {
    try {
      const result = await OtpService.verifyOtp(req.body);

      // Set session cookie when OTP verification is successful
      const maxAge = result.expiresAt
        ? Math.max(result.expiresAt - Date.now(), 0)
        : 24 * 60 * 60 * 1000;

      res.cookie(env.sessionCookieName, result.token, {
        httpOnly: true,
        secure: env.nodeEnv === "production",
        sameSite: env.nodeEnv === "production" ? "none" : "lax",
        maxAge,
      });

      return sendSuccess(res, { user: result.user });
    } catch (error: any) {
      return sendError(
        res,
        error.message || "Failed to verify OTP",
        error.statusCode || 500
      );
    }
  }

  static async resendOtp(req: Request, res: Response) {
    try {
      const result = await OtpService.resendOtp(req.body);
      return sendSuccess(res, result);
    } catch (error: any) {
      // Handle rate limit error with additional data
      if (error.statusCode === 429 && error.data) {
        return sendError(
          res,
          error.message || "Failed to resend OTP",
          error.statusCode,
          error.data
        );
      }

      return sendError(
        res,
        error.message || "Failed to resend OTP",
        error.statusCode || 500
      );
    }
  }

  static async checkOtpStatus(req: Request, res: Response) {
    try {
      const result = await OtpService.checkOtpStatus(req.body);
      return sendSuccess(res, result);
    } catch (error: any) {
      return sendError(
        res,
        error.message || "Failed to check OTP status",
        error.statusCode || 500
      );
    }
  }
}
