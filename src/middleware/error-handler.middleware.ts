import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { sendError, ErrorPayload } from "../utils/response-builder.util";
import { ResponseError } from "../utils/response-error.util";

const formatZodErrors = (error: ZodError): Record<string, string[]> => {
  return error.issues.reduce<Record<string, string[]>>((acc, issue) => {
    const path = issue.path.length ? issue.path.join(".") : "root";
    if (!acc[path]) {
      acc[path] = [];
    }
    acc[path].push(issue.message);
    return acc;
  }, {});
};

const toErrorPayload = (
  value: ErrorPayload | string | undefined,
  fallback: string
): ErrorPayload => {
  if (!value) {
    return { general: [fallback] };
  }

  if (typeof value === "string") {
    return { general: [value] };
  }

  return value;
};

export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const message = `Route ${req.originalUrl} not found`;
  next(new ResponseError(404, message));
};

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof ResponseError) {
    sendError(
      res,
      toErrorPayload(err.details, err.message),
      err.statusCode,
      err.additionalData
    );
    return;
  } else if (err instanceof ZodError) {
    const validationErrors = formatZodErrors(err);
    sendError(res, validationErrors, 400);
    return;
  } else {
    const statusCode = res.statusCode >= 400 ? res.statusCode : 500;
    sendError(res, err.message || "Internal Server Error", statusCode);
  }
};
