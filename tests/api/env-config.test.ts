describe("env.config OTP duration parsing", () => {
  const originalEnv = { ...process.env };

  const loadEnvConfig = async () => {
    jest.resetModules();
    return (await import("../../src/config/env.config")).default;
  };

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
});
