import { ZodType } from "zod";

export function validate<T>(zodType: ZodType<T>, data: unknown): T {
  return zodType.parse(data);
}
