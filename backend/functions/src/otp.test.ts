import {describe, expect, it} from 'vitest';
import {
  assertOtpFormat,
  canResend,
  generateOtp,
  hashOtp,
  isExpired,
  isValidEmail,
  normalizeEmail,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
} from './otp';

const OTP_KEY = 'test-only-key';

describe('email and OTP validation', () => {
  it('normalizes and validates email addresses', () => {
    expect(normalizeEmail('  Person@Example.COM ')).toBe('person@example.com');
    expect(isValidEmail('person@example.com')).toBe(true);
    expect(isValidEmail('invalid.example.com')).toBe(false);
    expect(isValidEmail('person@.com')).toBe(false);
  });

  it('generates a six digit OTP without exposing it in storage', () => {
    const otp = generateOtp();
    expect(otp).toMatch(/^\d{6}$/);
    const storedHash = hashOtp(otp, OTP_KEY);
    expect(storedHash).not.toBe(otp);
    expect(storedHash).toHaveLength(64);
  });

  it('enforces OTP format', () => {
    expect(assertOtpFormat('12 3456')).toBe('123456');
    expect(() => assertOtpFormat('12345')).toThrow('6-digit');
  });
});

describe('OTP lifecycle', () => {
  const now = 1_700_000_000_000;

  it('expires after ten minutes', () => {
    expect(isExpired(now + OTP_TTL_MS - 1, now)).toBe(false);
    expect(isExpired(now + OTP_TTL_MS, now + OTP_TTL_MS)).toBe(true);
  });

  it('enforces resend cooldown', () => {
    expect(canResend({createdAt: now, resentAt: now}, now + OTP_RESEND_COOLDOWN_MS - 1)).toBe(false);
    expect(canResend({createdAt: now, resentAt: now}, now + OTP_RESEND_COOLDOWN_MS)).toBe(true);
  });
});
