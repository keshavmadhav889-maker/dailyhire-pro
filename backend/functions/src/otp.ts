import {createHmac, randomInt, timingSafeEqual} from 'node:crypto';

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const REQUEST_WINDOW_MS = 10 * 60 * 1000;
export const REQUEST_LIMIT = 5;

export type UserRole = 'employer' | 'worker';

export interface OtpChallenge {
  emailHash: string;
  role: UserRole;
  otpHash: string;
  expiresAt: number;
  attempts: number;
  consumed: boolean;
  createdAt: number;
  resentAt?: number;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  const value = normalizeEmail(email);
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isValidRole(role: string): role is UserRole {
  return role === 'employer' || role === 'worker';
}

export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(OTP_LENGTH, '0');
}

export function hashValue(value: string, key: string): string {
  return createHmac('sha256', key).update(value).digest('hex');
}

export function hashEmail(email: string, key: string): string {
  return hashValue(normalizeEmail(email), key);
}

export function hashOtp(otp: string, key: string): string {
  return hashValue(otp, key);
}

export function otpMatches(otp: string, expectedHash: string, key: string): boolean {
  const actual = Buffer.from(hashOtp(otp, key), 'utf8');
  const expected = Buffer.from(expectedHash, 'utf8');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function isExpired(expiresAt: number, now = Date.now()): boolean {
  return expiresAt <= now;
}

export function canResend(challenge: Pick<OtpChallenge, 'resentAt' | 'createdAt'>, now = Date.now()): boolean {
  const lastSentAt = challenge.resentAt ?? challenge.createdAt;
  return now - lastSentAt >= OTP_RESEND_COOLDOWN_MS;
}

export function assertOtpFormat(otp: string): string {
  const value = otp.replace(/\s/g, '');
  if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(value)) {
    throw new Error('OTP must be a 6-digit code');
  }
  return value;
}
