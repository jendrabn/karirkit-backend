import fs from 'fs';
import path from 'path';
import { NextFunction, Request, Response } from 'express';
import winston from 'winston';
import env from '../config/env.config';

const { combine, timestamp, errors, printf, colorize } = winston.format;

const formatLogMessage = printf(({ level, message, timestamp: time, stack, ...meta }) => {
  const metaString = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return stack
    ? `[${time}] ${level}: ${message}\n${stack}${metaString}`
    : `[${time}] ${level}: ${message}${metaString}`;
});

const logFilePath = path.resolve(process.cwd(), env.logFile);
fs.mkdirSync(path.dirname(logFilePath), { recursive: true });

export const appLogger = winston.createLogger({
  level: env.logLevel,
  transports: [
    new winston.transports.Console({
      format: combine(colorize({ all: true }), timestamp(), errors({ stack: true }), formatLogMessage)
    }),
    new winston.transports.File({
      filename: logFilePath,
      format: combine(timestamp(), errors({ stack: true }), formatLogMessage)
    })
  ]
});

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    appLogger.info('HTTP request completed', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: duration,
      userAgent: req.get('user-agent')
    });
  });
  next();
};

export default requestLogger;
