import {Resend} from 'resend';
import {secrets} from './config';

const resend = new Resend(secrets.resendApiKey);

export async function sendOtpEmail(email: string, otp: string, language: 'en' | 'hi'): Promise<void> {
  const isHindi = language === 'hi';
  await resend.emails.send({
    from: secrets.resendFromEmail,
    to: email,
    subject: isHindi ? 'DailyHire OTP' : 'Your DailyHire one-time password',
    html: isHindi
      ? `<p>DailyHire में आपका one-time password:</p><h1>${otp}</h1><p>यह कोड 10 मिनट तक मान्य है।</p>`
      : `<p>Your DailyHire one-time password:</p><h1>${otp}</h1><p>This code is valid for 10 minutes.</p>`,
  });
}
