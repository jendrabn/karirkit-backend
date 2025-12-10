import { NextFunction, Request, Response } from 'express';
import { sendError } from '../utils/response-builder.util';

export const validateUserIdParam = (req: Request, res: Response, next: NextFunction): void => {
  const { id } = req.params;
  const parsed = Number(id);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    sendError(res, 'User id must be a positive integer', 400);
    return;
  }

  next();
};
