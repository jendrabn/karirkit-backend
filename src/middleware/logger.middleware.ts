import pino from "pino";
import pinoHttp from "pino-http";
import path from "path";
import fs from "fs";
import env from "../config/env.config";

const logFilePath = path.resolve(process.cwd(), env.logFile);
fs.mkdirSync(path.dirname(logFilePath), { recursive: true });

export const appLogger = pino({
  level: env.logLevel || "info",
  transport: {
    targets: [
      {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      },
      {
        target: "pino/file",
        options: {
          destination: logFilePath,
          mkdir: true,
        },
      },
    ],
  },
});

export const requestLogger = pinoHttp({
  logger: appLogger,
  customSuccessMessage: (req, res, responseTime) => {
    return `HTTP ${req.method} ${req.url} ${res.statusCode} ${responseTime}ms`;
  },
  customErrorMessage: (req, res, err) => {
    return `HTTP ${req.method} ${req.url} failed with ${res.statusCode}`;
  },
  serializers: {
    req: (req) => {
      const headers = { ...req.headers };
      delete headers.authorization;
      delete headers.cookie;

      return {
        method: req.method,
        url: req.url,
        query: req.query,
        headers,
      };
    },
    res: (res) => ({
      statusCode: res.statusCode,
    }),
    err: pino.stdSerializers.err,
  },
});

import type { Request, Response, NextFunction } from "express";

export const errorLogger = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  appLogger.error(
    {
      path: req.originalUrl,
      method: req.method,
      statusCode: res.statusCode,
      errorName: err.name,
      errorMessage: err.message,
      err: err,
    },
    `HTTP ${req.method} ${req.originalUrl} failed with ${res.statusCode}`,
  );
  next(err);
};

export default requestLogger;
