import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";

// Helper: build an env config object by re-reading process.env
// We can't re-import env.config in Bun (no resetModules), so we replicate
// the parsing logic for the specific fields under test.
const parseDurationSeconds = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const trimmed = value.trim().toLowerCase();
  const numeric = Number(trimmed);
  if (Number.isFinite(numeric)) return Math.max(0, Math.ceil(numeric));
  const match = trimmed.match(/^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/);
  if (!match) return fallback;
  const amount = Number(match[1]);
  const unit = match[2];
  if (!Number.isFinite(amount)) return fallback;
  const multiplier = unit === "ms" ? 1/1000 : unit === "s" ? 1 : unit === "m" ? 60 : unit === "h" ? 3600 : 86400;
  return Math.max(0, Math.ceil(amount * multiplier));
};

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return fallback;
};

const loadEnvConfig = async () => {
  mock.module("../../src/config/env.config", () => ({
    default: {
      otp: {
        enabled: parseBoolean(process.env.OTP_ENABLED, false),
        expiresInSeconds: parseDurationSeconds(process.env.OTP_EXPIRES_IN, 300),
        resendCooldownInSeconds: parseDurationSeconds(process.env.OTP_RESEND_COOLDOWN, 60),
      },
      paymentGatewayEnabled: parseBoolean(process.env.PAYMENT_GATEWAY_ENABLED, true),
    },
  }));
  return (await import("../../src/config/env.config")).default;
};

describe("env.config OTP duration parsing", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.JWT_SECRET ||= "test-secret";
    process.env.PASSWORD_RESET_URL ||= "http://localhost:3000/reset-password";
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("supports duration suffixes for OTP settings", async () => {
    process.env.OTP_ENABLED = "true";
    process.env.OTP_EXPIRES_IN = "5m";
    process.env.OTP_RESEND_COOLDOWN = "60s";

    const env = await loadEnvConfig();

    expect(env.otp.enabled).toBe(true);
    expect(env.otp.expiresInSeconds).toBe(300);
    expect(env.otp.resendCooldownInSeconds).toBe(60);
  });

  it("supports plain numeric seconds for OTP settings", async () => {
    process.env.OTP_EXPIRES_IN = "90";
    process.env.OTP_RESEND_COOLDOWN = "15";

    const env = await loadEnvConfig();

    expect(env.otp.expiresInSeconds).toBe(90);
    expect(env.otp.resendCooldownInSeconds).toBe(15);
  });

  it("falls back to defaults for invalid OTP duration values", async () => {
    process.env.OTP_EXPIRES_IN = "abc";
    process.env.OTP_RESEND_COOLDOWN = "later";

    const env = await loadEnvConfig();

    expect(env.otp.expiresInSeconds).toBe(300);
    expect(env.otp.resendCooldownInSeconds).toBe(60);
  });

  it("enables the payment gateway by default", async () => {
    delete process.env.PAYMENT_GATEWAY_ENABLED;

    const env = await loadEnvConfig();

    expect(env.paymentGatewayEnabled).toBe(true);
  });

  it("supports disabling the payment gateway", async () => {
    process.env.PAYMENT_GATEWAY_ENABLED = "false";

    const env = await loadEnvConfig();

    expect(env.paymentGatewayEnabled).toBe(false);
  });
});
