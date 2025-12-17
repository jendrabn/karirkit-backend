import { Request, Response } from "express";
import { OtpService } from "../services/otp.service";
import { sendSuccess, sendError } from "../utils/response-builder.util";

export class OtpController {
  static async sendOtp(req: Request, res: Response) {
    try {
      await OtpService.sendOtp(req.body);
      return sendSuccess(res, { message: "OTP sent successfully" });
    } catch (error: any) {
      return sendError(
        res,
        error.message || "Failed to send OTP",
        error.statusCode || 500
      );
    }
  }

  static async verifyOtp(req: Request, res: Response) {
    try {
      const result = await OtpService.verifyOtp(req.body);
      return sendSuccess(res, result);
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
