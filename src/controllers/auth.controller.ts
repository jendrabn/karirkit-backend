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
import { sendSuccess } from "../utils/response-builder.util";

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
}
