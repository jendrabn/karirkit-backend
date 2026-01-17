import { z } from "zod";

const normalizeArrayInput = (value: unknown): string[] | undefined => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const values = Array.isArray(value) ? value : [value];
  const result: string[] = [];

  for (const entry of values) {
    if (typeof entry !== "string") {
      continue;
    }
    const parts = entry
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    result.push(...parts);
  }

  return result.length ? result : undefined;
};

const parseBoolean = (value: unknown): boolean | undefined => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }
  return value as boolean;
};

const parseNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value === "number") {
    return value;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return value as number;
  }
  return parsed;
};

export const commaSeparatedStringSchema = z.preprocess(
  normalizeArrayInput,
  z.array(z.string().min(1))
);

export const commaSeparatedEnumSchema = <T extends [string, ...string[]]>(
  values: T
) => z.preprocess(normalizeArrayInput, z.array(z.enum(values)));

export const commaSeparatedNativeEnum = <T extends Record<string, string>>(
  enumValues: T
) =>
  z.preprocess(normalizeArrayInput, z.array(z.nativeEnum(enumValues)));

export const optionalBooleanSchema = z.preprocess(parseBoolean, z.boolean())
  .optional();

export const optionalNumberSchema = (schema: z.ZodNumber) =>
  z.preprocess(parseNumber, schema).optional();

export const optionalDateSchema = (schema: z.ZodType<string>) =>
  z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    schema
  ).optional();
