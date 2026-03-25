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
import {
  buildSessionClearCookieOptions,
  buildSessionCookieOptions,
} from "../utils/session-auth.util";

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
      if ("requires_otp" in result && result.requires_otp) {
        sendSuccess(res, {
          message: result.message,
          requires_otp: true,
          expires_at: result.expires_at,
          expires_in: result.expires_in,
          resend_available_at: result.resend_available_at,
        });
        return;
      }

      // Normal login flow
      const { token, user, expires_at } = result as {
        token: string;
        user: any;
        expires_at?: number;
      };

      res.cookie(
        env.sessionCookieName,
        token,
        buildSessionCookieOptions(expires_at)
      );

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
      const { token, user, expires_at } = await AuthService.loginWithGoogle(
        req.body as GoogleLoginRequest
      );
      res.cookie(
        env.sessionCookieName,
        token,
        buildSessionCookieOptions(expires_at)
      );

      sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  }

  static async logout(_req: Request, res: Response, next: NextFunction) {
    try {
      res.clearCookie(env.sessionCookieName, buildSessionClearCookieOptions());

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

  static async verifyOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await OtpService.verifyOtp(req.body);

      // Set session cookie when OTP verification is successful
      res.cookie(
        env.sessionCookieName,
        result.token,
        buildSessionCookieOptions(result.expires_at)
      );

      return sendSuccess(res, result.user);
    } catch (error) {
      next(error);
    }
  }

  static async resendOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await OtpService.resendOtp(req.body);
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async checkOtpStatus(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const result = await OtpService.checkOtpStatus(req.body);
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
}
