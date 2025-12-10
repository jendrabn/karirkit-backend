import { Response } from "express";

export type SuccessPayload<T> = { data: T };
export type ErrorPayload = Record<string, string[]>;

const normalizeErrors = (errors: ErrorPayload | string): ErrorPayload => {
  if (typeof errors === "string") {
    return { general: [errors] };
  }
  return errors;
};

export const sendSuccess = <T>(
  res: Response,
  data?: T,
  statusCode = data === undefined ? 204 : 200
): Response<SuccessPayload<T> | Record<string, never>> => {
  if (data === undefined) {
    return res.status(statusCode).json({});
  }

  return res.status(statusCode).json({
    data,
  });
};

export const sendError = (
  res: Response,
  errors: ErrorPayload | string,
  statusCode = 400
): Response<{ errors: ErrorPayload }> => {
  return res.status(statusCode).json({
    errors: normalizeErrors(errors),
  });
};
