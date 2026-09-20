import {getApps, initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {getMessaging} from 'firebase-admin/messaging';

if (!getApps().length) {
  initializeApp();
}

export const db = getFirestore();
export const auth = getAuth();
export const messaging = getMessaging();

export const secrets = {
  resendApiKey: requiredSecret('RESEND_API_KEY'),
  resendFromEmail: requiredSecret('RESEND_FROM_EMAIL'),
  otpHashKey: requiredSecret('OTP_HASH_KEY'),
} as const;

function requiredSecret(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required server secret ${name} is not configured`);
  }
  return value;
}
