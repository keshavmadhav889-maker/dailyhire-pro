"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.secrets = exports.messaging = exports.auth = exports.db = void 0;
const app_1 = require("firebase-admin/app");
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const messaging_1 = require("firebase-admin/messaging");
if (!(0, app_1.getApps)().length) {
    (0, app_1.initializeApp)();
}
exports.db = (0, firestore_1.getFirestore)();
exports.auth = (0, auth_1.getAuth)();
exports.messaging = (0, messaging_1.getMessaging)();
exports.secrets = {
    resendApiKey: requiredSecret('RESEND_API_KEY'),
    resendFromEmail: requiredSecret('RESEND_FROM_EMAIL'),
    otpHashKey: requiredSecret('OTP_HASH_KEY'),
};
function requiredSecret(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Required server secret ${name} is not configured`);
    }
    return value;
}
//# sourceMappingURL=config.js.map