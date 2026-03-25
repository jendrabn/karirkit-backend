import { z } from "zod";

export class SystemSettingValidation {
  static readonly LIST_QUERY = z.object({
    group: z
      .enum(["system", "auth", "downloads", "public", "uploads", "limits"])
      .optional(),
  });

  static readonly UPDATE_PAYLOAD = z.object({
    value: z.unknown(),
  });
}
