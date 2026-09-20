"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendOtpEmail = sendOtpEmail;
const resend_1 = require("resend");
const config_1 = require("./config");
const resend = new resend_1.Resend(config_1.secrets.resendApiKey);
async function sendOtpEmail(email, otp, language) {
    const isHindi = language === 'hi';
    await resend.emails.send({
        from: config_1.secrets.resendFromEmail,
        to: email,
        subject: isHindi ? 'DailyHire OTP' : 'Your DailyHire one-time password',
        html: isHindi
            ? `<p>DailyHire में आपका one-time password:</p><h1>${otp}</h1><p>यह कोड 10 मिनट तक मान्य है।</p>`
            : `<p>Your DailyHire one-time password:</p><h1>${otp}</h1><p>This code is valid for 10 minutes.</p>`,
    });
}
//# sourceMappingURL=email.js.map