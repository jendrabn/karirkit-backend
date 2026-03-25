import { z } from "zod";

export class SystemSettingValidation {
  static readonly BULK_UPDATE_PAYLOAD = z.record(z.string(), z.unknown());
}
