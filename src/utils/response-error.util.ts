import type { ErrorPayload } from "./response-builder.util";

export class ResponseError extends Error {
  public readonly statusCode: number;
  public readonly details?: ErrorPayload | string;
  public readonly additionalData?: Record<string, unknown>;

  constructor(
    statusCode: number,
    message: string,
    details?: ErrorPayload | string,
    additionalData?: Record<string, unknown>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.additionalData = additionalData;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
