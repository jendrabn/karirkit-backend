import { NextFunction, Request, Response } from "express";
import { ResponseError } from "../utils/response-error.util";

export const adminMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Check if user is authenticated (authMiddleware should have run before this)
    if (!req.user) {
      throw new ResponseError(401, "Unauthenticated");
    }

    // Check if user has admin role
    if (req.user.role !== "admin") {
      throw new ResponseError(403, "Admin access required");
    }

    next();
  } catch (error) {
    next(error);
  }
};

export default adminMiddleware;
