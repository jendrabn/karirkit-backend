import type { ErrorPayload } from "./response-builder.util";

export class ResponseError extends Error {
  public readonly statusCode: number;
  public readonly details?: ErrorPayload | string;

  constructor(statusCode: number, message: string, details?: ErrorPayload | string) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
