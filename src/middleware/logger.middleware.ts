import fs from "fs";
import path from "path";
import expressWinston from "express-winston";
import winston from "winston";
import env from "../config/env.config";

const { combine, timestamp, errors, printf, colorize } = winston.format;

const formatLogMessage = printf(
  ({ level, message, timestamp: time, stack, ...meta }) => {
    const metaString = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    return stack
      ? `[${time}] ${level}: ${message}\n${stack}${metaString}`
      : `[${time}] ${level}: ${message}${metaString}`;
  }
);

const logFilePath = path.resolve(process.cwd(), env.logFile);
fs.mkdirSync(path.dirname(logFilePath), { recursive: true });

const consoleFormat = combine(
  colorize({ all: true }),
  timestamp(),
  errors({ stack: true }),
  formatLogMessage
);

const fileFormat = combine(timestamp(), errors({ stack: true }), formatLogMessage);

export const appLogger = winston.createLogger({
  level: env.logLevel,
  transports: [
    new winston.transports.Console({
      format: consoleFormat,
    }),
    new winston.transports.File({
      filename: logFilePath,
      format: fileFormat,
    }),
  ],
});

export const requestLogger = expressWinston.logger({
  winstonInstance: appLogger,
  meta: true,
  msg: "HTTP {{req.method}} {{req.url}} {{res.statusCode}} {{res.responseTime}}ms",
  expressFormat: false,
  colorize: false,
  requestWhitelist: ["url", "headers", "method", "httpVersion", "originalUrl", "query"],
  responseWhitelist: ["statusCode"],
  requestFilter: (req, prop) => {
    if (prop === "headers") {
      const headers = { ...req.headers };
      delete headers.authorization;
      delete headers.cookie;
      return headers;
    }

    return req[prop as keyof typeof req];
  },
});

export const errorLogger = expressWinston.errorLogger({
  winstonInstance: appLogger,
  msg: "HTTP {{req.method}} {{req.url}} failed with {{res.statusCode}}",
  dynamicMeta: (req, res, err) => ({
    path: req.originalUrl,
    method: req.method,
    statusCode: res.statusCode,
    errorName: err.name,
    errorMessage: err.message,
  }),
});

export default requestLogger;
