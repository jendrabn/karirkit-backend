import { Request, Response } from "express";
import { OtpService } from "../services/otp.service";
import { sendSuccess, sendError } from "../utils/response-builder.util";
import env from "../config/env.config";

export class OtpController {
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
        sameSite: "lax",
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
      await OtpService.resendOtp(req.body);
      return sendSuccess(res, { message: "OTP resent successfully" });
    } catch (error: any) {
      return sendError(
        res,
        error.message || "Failed to resend OTP",
        error.statusCode || 500
      );
    }
  }
}
