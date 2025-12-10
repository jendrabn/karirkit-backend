import { Request, Response } from "express";
import env from "../config/env.config";
import { sendSuccess } from "../utils/response-builder.util";

export const getHealth = (_req: Request, res: Response): void => {
  sendSuccess(
    res,
    {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: env.nodeEnv,
    },
    200
  );
};
