import type {OtpChallenge} from './otp';
import {otpMatches} from './otp';

export type ActorRole = 'employer' | 'worker' | 'admin';
export type OtpFailureReason = 'invalid' | 'expired' | 'attempts_exceeded' | 'consumed' | 'role_mismatch';

export interface OtpEvaluation {
  allowed: boolean;
  reason?: OtpFailureReason;
}

export function evaluateOtp(
  challenge: OtpChallenge | undefined,
  otp: string,
  otpHashKey: string,
  now: number,
): OtpEvaluation {
  if (!challenge || challenge.consumed) return {allowed: false, reason: challenge ? 'consumed' : 'invalid'};
  if (challenge.expiresAt <= now) return {allowed: false, reason: 'expired'};
  if (challenge.attempts >= 5) return {allowed: false, reason: 'attempts_exceeded'};
  if (!otpMatches(otp, challenge.otpHash, otpHashKey)) return {allowed: false, reason: 'invalid'};
  return {allowed: true};
}

export function canManageJob(actorUid: string, role: ActorRole, employerId: string, blocked: boolean): boolean {
  return !blocked && (role === 'admin' || (role === 'employer' && actorUid === employerId));
}

export function canManageApplicationAsWorker(
  actorUid: string,
  role: ActorRole,
  workerId: string,
  status: string,
  blocked: boolean,
): boolean {
  return !blocked && role === 'worker' && actorUid === workerId && status === 'pending';
}

export function canManageApplicationAsEmployer(
  actorUid: string,
  role: ActorRole,
  employerId: string,
  status: string,
  blocked: boolean,
): boolean {
  return !blocked && role === 'employer' && actorUid === employerId && status === 'pending';
}

export function applicationDocumentId(jobId: string, workerId: string): string {
  return `${jobId}:${workerId}`;
}

export function isDuplicateApplication(existingApplicationId: string | undefined, jobId: string, workerId: string): boolean {
  return existingApplicationId === applicationDocumentId(jobId, workerId);
}

export function isActiveActor(role: ActorRole, blocked: boolean): boolean {
  return !blocked && (role === 'employer' || role === 'worker' || role === 'admin');
}
