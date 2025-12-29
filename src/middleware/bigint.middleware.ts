import { NextFunction, Request, Response } from "express";

// Middleware to handle BigInt serialization in JSON responses
export const bigIntMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Store the original res.json method
  const originalJson = res.json;

  // Override res.json method
  res.json = function (data: any) {
    // Convert BigInt values to strings
    const convertedData = JSON.parse(
      JSON.stringify(data, (_, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );

    // Call the original json method with converted data
    return originalJson.call(this, convertedData);
  };

  next();
};

export default bigIntMiddleware;
