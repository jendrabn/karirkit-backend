import { Prisma, type SystemSettingType } from "../generated/prisma/client";
import env from "../config/env.config";
import { prisma } from "../config/prisma.config";
import { ResponseError } from "../utils/response-error.util";
import { validate } from "../utils/validate.util";
import { SystemSettingValidation } from "../validations/admin/system-setting.validation";

type SettingPrimitive = boolean | number | string | Prisma.JsonObject | Prisma.JsonArray;

type SettingDefinition = {
  key: string;
  group: string;
  type: SystemSettingType;
  defaultValue: SettingPrimitive;
  description: string;
  isPublic?: boolean;
  isEditable?: boolean;
  min?: number;
  max?: number;
};

type SystemSettingResponse = {
  id: string | null;
  key: string;
  group: string;
  type: SystemSettingType;
  value: Prisma.JsonValue;
  default_value: Prisma.JsonValue;
  description: string;
  is_public: boolean;
  is_editable: boolean;
  source: "default" | "database";
  updated_by: string | null;
  updated_at: string | null;
  created_at: string | null;
};

type SystemSettingListResult = {
  items: SystemSettingResponse[];
};

const CACHE_TTL_MS = process.env.NODE_ENV === "test" ? 0 : 15_000;

const settingDefinitions: SettingDefinition[] = [
  {
    key: "auth.registration.enabled",
    group: "auth",
    type: "boolean",
    defaultValue: true,
    description: "Mengaktifkan atau menonaktifkan registrasi akun baru.",
  },
  {
    key: "auth.google_login.enabled",
    group: "auth",
    type: "boolean",
    defaultValue: true,
    description: "Mengaktifkan login menggunakan Google.",
  },
  {
    key: "auth.password_reset.enabled",
    group: "auth",
    type: "boolean",
    defaultValue: true,
    description: "Mengaktifkan alur lupa kata sandi dan reset kata sandi.",
  },
  {
    key: "auth.otp.enabled",
    group: "auth",
    type: "boolean",
    defaultValue: env.otp.enabled,
    description: "Mengaktifkan OTP untuk proses login.",
  },
  {
    key: "auth.otp.expires_in_seconds",
    group: "auth",
    type: "number",
    defaultValue: env.otp.expiresInSeconds,
    min: 30,
    max: 3600,
    description: "Durasi kedaluwarsa OTP dalam detik.",
  },
  {
    key: "auth.otp.resend_cooldown_seconds",
    group: "auth",
    type: "number",
    defaultValue: env.otp.resendCooldownInSeconds,
    min: 15,
    max: 3600,
    description: "Jeda minimum sebelum OTP dapat dikirim ulang.",
  },
  {
    key: "downloads.block_all.enabled",
    group: "downloads",
    type: "boolean",
    defaultValue: false,
    description: "Kill switch untuk menonaktifkan seluruh fitur unduhan dokumen.",
  },
  {
    key: "downloads.cv.docx.enabled",
    group: "downloads",
    type: "boolean",
    defaultValue: true,
    description: "Mengaktifkan unduhan CV dalam format DOCX.",
  },
  {
    key: "downloads.cv.pdf.enabled",
    group: "downloads",
    type: "boolean",
    defaultValue: env.pdfDownloadEnabled,
    description: "Mengaktifkan unduhan CV dalam format PDF.",
  },
  {
    key: "downloads.application_letter.docx.enabled",
    group: "downloads",
    type: "boolean",
    defaultValue: true,
    description: "Mengaktifkan unduhan surat lamaran dalam format DOCX.",
  },
  {
    key: "downloads.application_letter.pdf.enabled",
    group: "downloads",
    type: "boolean",
    defaultValue: env.pdfDownloadEnabled,
    description: "Mengaktifkan unduhan surat lamaran dalam format PDF.",
  },
  {
    key: "public.cv.enabled",
    group: "public",
    type: "boolean",
    defaultValue: true,
    description: "Mengaktifkan CV publik melalui slug.",
  },
  {
    key: "uploads.temp.enabled",
    group: "uploads",
    type: "boolean",
    defaultValue: true,
    description: "Mengaktifkan unggahan file sementara.",
  },
  {
    key: "uploads.blog.enabled",
    group: "uploads",
    type: "boolean",
    defaultValue: true,
    description: "Mengaktifkan unggahan media blog.",
  },
  {
    key: "uploads.document.enabled",
    group: "uploads",
    type: "boolean",
    defaultValue: true,
    description: "Mengaktifkan unggahan dokumen pengguna.",
  },
  {
    key: "uploads.temp.max_size_mb",
    group: "uploads",
    type: "number",
    defaultValue: 10,
    min: 1,
    max: 100,
    description: "Ukuran maksimum file unggahan sementara dalam MB.",
  },
  {
    key: "uploads.blog.max_size_mb",
    group: "uploads",
    type: "number",
    defaultValue: 5,
    min: 1,
    max: 50,
    description: "Ukuran maksimum file unggahan blog dalam MB.",
  },
  {
    key: "uploads.document.max_size_mb",
    group: "uploads",
    type: "number",
    defaultValue: 25,
    min: 1,
    max: 100,
    description: "Ukuran maksimum file unggahan dokumen dalam MB.",
  },
  {
    key: "uploads.document.max_file_count",
    group: "uploads",
    type: "number",
    defaultValue: 20,
    min: 1,
    max: 50,
    description: "Jumlah maksimum file dalam satu unggahan dokumen.",
  },
  {
    key: "limits.user.default_daily_download",
    group: "limits",
    type: "number",
    defaultValue: 10,
    min: 1,
    max: 100000,
    description: "Kuota unduhan harian default untuk user baru.",
  },
  {
    key: "limits.user.default_storage_bytes",
    group: "limits",
    type: "number",
    defaultValue: 100 * 1024 * 1024,
    min: 1024 * 1024,
    max: env.documentStorageLimitMaxBytes,
    description: "Kuota penyimpanan dokumen default untuk user baru dalam bytes.",
  },
];

const definitionMap = new Map(
  settingDefinitions.map((definition) => [definition.key, definition])
);

export class SystemSettingService {
  private static cache:
    | {
        values: Map<string, Prisma.JsonValue>;
        expiresAt: number;
      }
    | null = null;

  static getDefinitions(): SettingDefinition[] {
    return settingDefinitions;
  }

  static async list(query: unknown): Promise<SystemSettingListResult> {
    const dbSettings = await prisma.systemSetting.findMany({
      orderBy: [{ group: "asc" }, { key: "asc" }],
    });

    const dbMap = new Map(dbSettings.map((setting) => [setting.key, setting]));
    const items = settingDefinitions.map((definition) =>
      SystemSettingService.toResponse(definition, dbMap.get(definition.key))
    );

    return { items };
  }

  static async bulkUpdate(
    request: unknown,
    updatedBy: string
  ): Promise<SystemSettingListResult> {
    const payload = validate(SystemSettingValidation.BULK_UPDATE_PAYLOAD, request);
    const updates = SystemSettingService.flattenPayloadToUpdates(payload);

    if (updates.size === 0) {
      throw new ResponseError(400, "Payload pengaturan sistem tidak boleh kosong");
    }

    const preparedUpdates = Array.from(updates.entries()).map(([key, value]) => {
      const definition = SystemSettingService.getDefinitionOrThrow(key);
      return {
        definition,
        value: SystemSettingService.normalizeValue(definition, value),
      };
    });

    const now = new Date();
    const storedSettings = await prisma.$transaction(async (tx) => {
      return Promise.all(
        preparedUpdates.map((update) =>
          tx.systemSetting.upsert({
            where: { key: update.definition.key },
            update: {
              group: update.definition.group,
              type: update.definition.type,
              valueJson: update.value,
              defaultValueJson: update.definition.defaultValue as Prisma.InputJsonValue,
              description: update.definition.description,
              isPublic: update.definition.isPublic ?? false,
              isEditable: update.definition.isEditable ?? true,
              updatedBy,
              updatedAt: now,
            },
            create: {
              key: update.definition.key,
              group: update.definition.group,
              type: update.definition.type,
              valueJson: update.value,
              defaultValueJson: update.definition.defaultValue as Prisma.InputJsonValue,
              description: update.definition.description,
              isPublic: update.definition.isPublic ?? false,
              isEditable: update.definition.isEditable ?? true,
              updatedBy,
              createdAt: now,
              updatedAt: now,
            },
          })
        )
      );
    });

    const storedMap = new Map(storedSettings.map((setting) => [setting.key, setting]));
    SystemSettingService.clearCache();

    return {
      items: preparedUpdates.map((update) =>
        SystemSettingService.toResponse(
          update.definition,
          storedMap.get(update.definition.key)
        )
      ),
    };
  }

  static async getBoolean(key: string): Promise<boolean> {
    const definition = SystemSettingService.getDefinitionOrThrow(key, "boolean");
    const value = await SystemSettingService.getValue(key);
    return Boolean(value);
  }

  static async getNumber(key: string): Promise<number> {
    SystemSettingService.getDefinitionOrThrow(key, "number");
    const value = await SystemSettingService.getValue(key);
    return Number(value);
  }

  static async isRegistrationEnabled(): Promise<boolean> {
    return SystemSettingService.getBoolean("auth.registration.enabled");
  }

  static async isGoogleLoginEnabled(): Promise<boolean> {
    return SystemSettingService.getBoolean("auth.google_login.enabled");
  }

  static async isPasswordResetEnabled(): Promise<boolean> {
    return SystemSettingService.getBoolean("auth.password_reset.enabled");
  }

  static async isOtpEnabled(): Promise<boolean> {
    return SystemSettingService.getBoolean("auth.otp.enabled");
  }

  static async getOtpExpiresInSeconds(): Promise<number> {
    return SystemSettingService.getNumber("auth.otp.expires_in_seconds");
  }

  static async getOtpResendCooldownSeconds(): Promise<number> {
    return SystemSettingService.getNumber("auth.otp.resend_cooldown_seconds");
  }

  static async getDefaultDailyDownloadLimit(): Promise<number> {
    return SystemSettingService.getNumber("limits.user.default_daily_download");
  }

  static async getDefaultDocumentStorageLimit(): Promise<number> {
    return SystemSettingService.getNumber("limits.user.default_storage_bytes");
  }

  static async getTempUploadConfig(): Promise<{ enabled: boolean; maxSizeBytes: number }> {
    const [enabled, maxSizeMb] = await Promise.all([
      SystemSettingService.getBoolean("uploads.temp.enabled"),
      SystemSettingService.getNumber("uploads.temp.max_size_mb"),
    ]);
    return {
      enabled,
      maxSizeBytes: maxSizeMb * 1024 * 1024,
    };
  }

  static async getBlogUploadConfig(): Promise<{ enabled: boolean; maxSizeBytes: number }> {
    const [enabled, maxSizeMb] = await Promise.all([
      SystemSettingService.getBoolean("uploads.blog.enabled"),
      SystemSettingService.getNumber("uploads.blog.max_size_mb"),
    ]);
    return {
      enabled,
      maxSizeBytes: maxSizeMb * 1024 * 1024,
    };
  }

  static async getDocumentUploadConfig(): Promise<{
    enabled: boolean;
    maxSizeBytes: number;
    maxFileCount: number;
  }> {
    const [enabled, maxSizeMb, maxFileCount] = await Promise.all([
      SystemSettingService.getBoolean("uploads.document.enabled"),
      SystemSettingService.getNumber("uploads.document.max_size_mb"),
      SystemSettingService.getNumber("uploads.document.max_file_count"),
    ]);
    return {
      enabled,
      maxSizeBytes: maxSizeMb * 1024 * 1024,
      maxFileCount,
    };
  }

  static async assertDownloadsEnabled(scope: "cv" | "application_letter" | "document", format?: "pdf" | "docx"): Promise<void> {
    const blockAll = await SystemSettingService.getBoolean("downloads.block_all.enabled");
    if (blockAll) {
      throw new ResponseError(503, "Seluruh fitur unduhan sedang dinonaktifkan sementara.");
    }

    if (scope === "document") {
      return;
    }

    if (!format) {
      return;
    }

    const key = `downloads.${scope}.${format}.enabled`;
    const enabled = await SystemSettingService.getBoolean(key);
    if (!enabled) {
      throw new ResponseError(
        503,
        `Fitur unduh ${format.toUpperCase()} untuk ${scope === "cv" ? "CV" : "surat lamaran"} sedang dinonaktifkan.`
      );
    }
  }

  static clearCache(): void {
    SystemSettingService.cache = null;
  }

  private static async getValue(key: string): Promise<Prisma.JsonValue> {
    const values = await SystemSettingService.loadEffectiveValues();
    return values.get(key) ?? SystemSettingService.getDefinitionOrThrow(key).defaultValue;
  }

  private static async loadEffectiveValues(): Promise<Map<string, Prisma.JsonValue>> {
    if (
      CACHE_TTL_MS > 0 &&
      SystemSettingService.cache &&
      SystemSettingService.cache.expiresAt > Date.now()
    ) {
      return SystemSettingService.cache.values;
    }

    const settings = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: settingDefinitions.map((definition) => definition.key),
        },
      },
    });

    const values = new Map<string, Prisma.JsonValue>();
    for (const definition of settingDefinitions) {
      values.set(definition.key, definition.defaultValue as Prisma.JsonValue);
    }
    for (const setting of settings) {
      values.set(setting.key, setting.valueJson);
    }

    SystemSettingService.cache = {
      values,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };

    return values;
  }

  private static flattenPayloadToUpdates(
    payload: Record<string, unknown>,
    parentPath = "",
    updates = new Map<string, unknown>()
  ): Map<string, unknown> {
    for (const [key, value] of Object.entries(payload)) {
      const nextPath = parentPath ? `${parentPath}.${key}` : key;
      const definition = definitionMap.get(nextPath);

      if (definition) {
        if (updates.has(nextPath)) {
          throw new ResponseError(400, `Duplikat pengaturan sistem pada payload: ${nextPath}`);
        }
        updates.set(nextPath, value);
        continue;
      }

      if (SystemSettingService.isPlainObject(value)) {
        if (!SystemSettingService.hasDefinitionPrefix(nextPath)) {
          throw new ResponseError(400, `Pengaturan sistem tidak dikenal: ${nextPath}`);
        }
        SystemSettingService.flattenPayloadToUpdates(value, nextPath, updates);
        continue;
      }

      throw new ResponseError(400, `Pengaturan sistem tidak dikenal: ${nextPath}`);
    }

    return updates;
  }

  private static hasDefinitionPrefix(path: string): boolean {
    const prefix = `${path}.`;
    return settingDefinitions.some((definition) => definition.key.startsWith(prefix));
  }

  private static isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private static getDefinitionOrThrow(
    key: string,
    expectedType?: SystemSettingType
  ): SettingDefinition {
    const definition = definitionMap.get(key);
    if (!definition) {
      throw new ResponseError(404, "Pengaturan sistem tidak ditemukan");
    }
    if (expectedType && definition.type !== expectedType) {
      throw new ResponseError(400, "Tipe pengaturan sistem tidak sesuai");
    }
    return definition;
  }

  private static normalizeValue(
    definition: SettingDefinition,
    value: unknown
  ): Prisma.InputJsonValue {
    if (definition.isEditable === false) {
      throw new ResponseError(400, "Pengaturan ini tidak dapat diubah");
    }

    switch (definition.type) {
      case "boolean":
        if (typeof value !== "boolean") {
          throw new ResponseError(400, "Nilai harus berupa boolean");
        }
        return value;
      case "number": {
        if (typeof value !== "number" || !Number.isFinite(value)) {
          throw new ResponseError(400, "Nilai harus berupa number");
        }
        if (definition.min !== undefined && value < definition.min) {
          throw new ResponseError(400, `Nilai minimal adalah ${definition.min}`);
        }
        if (definition.max !== undefined && value > definition.max) {
          throw new ResponseError(400, `Nilai maksimal adalah ${definition.max}`);
        }
        return Math.floor(value);
      }
      case "string":
        if (typeof value !== "string") {
          throw new ResponseError(400, "Nilai harus berupa string");
        }
        return value;
      case "json":
        if (
          value === null ||
          typeof value === "boolean" ||
          typeof value === "number" ||
          typeof value === "string" ||
          Array.isArray(value) ||
          (typeof value === "object" && value !== null)
        ) {
          return value as Prisma.InputJsonValue;
        }
        throw new ResponseError(400, "Nilai JSON tidak valid");
    }
  }

  private static toResponse(
    definition: SettingDefinition,
    setting?: {
      id: string;
      key: string;
      group: string;
      type: SystemSettingType;
      valueJson: Prisma.JsonValue;
      defaultValueJson: Prisma.JsonValue;
      description: string | null;
      isPublic: boolean;
      isEditable: boolean;
      updatedBy: string | null;
      createdAt: Date;
      updatedAt: Date;
    }
  ): SystemSettingResponse {
    return {
      id: setting?.id ?? null,
      key: definition.key,
      group: definition.group,
      type: definition.type,
      value: setting?.valueJson ?? (definition.defaultValue as Prisma.JsonValue),
      default_value: setting?.defaultValueJson ?? (definition.defaultValue as Prisma.JsonValue),
      description: setting?.description ?? definition.description,
      is_public: setting?.isPublic ?? definition.isPublic ?? false,
      is_editable: setting?.isEditable ?? definition.isEditable ?? true,
      source: setting ? "database" : "default",
      updated_by: setting?.updatedBy ?? null,
      updated_at: setting?.updatedAt?.toISOString() ?? null,
      created_at: setting?.createdAt?.toISOString() ?? null,
    };
  }
}
