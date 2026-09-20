"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REQUEST_LIMIT = exports.REQUEST_WINDOW_MS = exports.OTP_RESEND_COOLDOWN_MS = exports.OTP_MAX_ATTEMPTS = exports.OTP_TTL_MS = exports.OTP_LENGTH = void 0;
exports.normalizeEmail = normalizeEmail;
exports.isValidEmail = isValidEmail;
exports.isValidRole = isValidRole;
exports.generateOtp = generateOtp;
exports.hashValue = hashValue;
exports.hashEmail = hashEmail;
exports.hashOtp = hashOtp;
exports.otpMatches = otpMatches;
exports.isExpired = isExpired;
exports.canResend = canResend;
exports.assertOtpFormat = assertOtpFormat;
const node_crypto_1 = require("node:crypto");
exports.OTP_LENGTH = 6;
exports.OTP_TTL_MS = 10 * 60 * 1000;
exports.OTP_MAX_ATTEMPTS = 5;
exports.OTP_RESEND_COOLDOWN_MS = 60 * 1000;
exports.REQUEST_WINDOW_MS = 10 * 60 * 1000;
exports.REQUEST_LIMIT = 5;
function normalizeEmail(email) {
    return email.trim().toLowerCase();
}
function isValidEmail(email) {
    const value = normalizeEmail(email);
    return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
function isValidRole(role) {
    return role === 'employer' || role === 'worker';
}
function generateOtp() {
    return (0, node_crypto_1.randomInt)(0, 1_000_000).toString().padStart(exports.OTP_LENGTH, '0');
}
function hashValue(value, key) {
    return (0, node_crypto_1.createHmac)('sha256', key).update(value).digest('hex');
}
function hashEmail(email, key) {
    return hashValue(normalizeEmail(email), key);
}
function hashOtp(otp, key) {
    return hashValue(otp, key);
}
function otpMatches(otp, expectedHash, key) {
    const actual = Buffer.from(hashOtp(otp, key), 'utf8');
    const expected = Buffer.from(expectedHash, 'utf8');
    return actual.length === expected.length && (0, node_crypto_1.timingSafeEqual)(actual, expected);
}
function isExpired(expiresAt, now = Date.now()) {
    return expiresAt <= now;
}
function canResend(challenge, now = Date.now()) {
    const lastSentAt = challenge.resentAt ?? challenge.createdAt;
    return now - lastSentAt >= exports.OTP_RESEND_COOLDOWN_MS;
}
function assertOtpFormat(otp) {
    const value = otp.replace(/\s/g, '');
    if (!new RegExp(`^\\d{${exports.OTP_LENGTH}}$`).test(value)) {
        throw new Error('OTP must be a 6-digit code');
    }
    return value;
}
//# sourceMappingURL=otp.js.map