import { NextFunction, Request, Response } from "express";
import { SystemSettingService } from "../services/system-setting.service";
import { ResponseError } from "../utils/response-error.util";

const isMaintenanceBypassPath = (path: string): boolean => {
  return (
    path === "/health" ||
    path.startsWith("/docs") ||
    path.startsWith("/auth/") ||
    path.startsWith("/admin/")
  );
};

const isReadOnlyBypassPath = (path: string): boolean => {
  return (
    path === "/health" ||
    path.startsWith("/docs") ||
    path.startsWith("/admin/system-settings")
  );
};

export const maintenanceModeMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (req.method === "OPTIONS" || isMaintenanceBypassPath(req.path)) {
      next();
      return;
    }

    const enabled = await SystemSettingService.isMaintenanceEnabled();
    if (!enabled) {
      next();
      return;
    }

    next(
      new ResponseError(
        503,
        "Sistem sedang dalam maintenance. Silakan coba lagi beberapa saat."
      )
    );
  } catch (error) {
    next(error as Error);
  }
};

export const readOnlyModeMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (
      ["GET", "HEAD", "OPTIONS"].includes(req.method) ||
      isReadOnlyBypassPath(req.path)
    ) {
      next();
      return;
    }

    const enabled = await SystemSettingService.isReadOnlyEnabled();
    if (!enabled) {
      next();
      return;
    }

    next(
      new ResponseError(
        503,
        "Sistem sedang dalam mode read-only. Operasi perubahan data dinonaktifkan sementara."
      )
    );
  } catch (error) {
    next(error as Error);
  }
};
