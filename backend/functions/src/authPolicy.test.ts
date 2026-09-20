import {describe, expect, it} from 'vitest';
import {
  applicationDocumentId,
  canManageApplicationAsEmployer,
  canManageApplicationAsWorker,
  canManageJob,
  evaluateOtp,
  isActiveActor,
  isDuplicateApplication,
} from './authPolicy';
import {hashOtp} from './otp';

const key = 'test-only-key';
const now = 1_700_000_000_000;

function challenge(overrides: Partial<Parameters<typeof evaluateOtp>[0]> = {}) {
  return {
    emailHash: 'email-hash',
    role: 'worker' as const,
    otpHash: hashOtp('123456', key),
    expiresAt: now + 600_000,
    attempts: 0,
    consumed: false,
    createdAt: now,
    ...overrides,
  };
}

describe('OTP verification policy', () => {
  it('accepts a valid unexpired challenge', () => {
    expect(evaluateOtp(challenge(), '123456', key, now).allowed).toBe(true);
  });

  it('rejects expired, consumed, and exhausted challenges', () => {
    expect(evaluateOtp(challenge({expiresAt: now - 1}), '123456', key, now).reason).toBe('expired');
    expect(evaluateOtp(challenge({consumed: true}), '123456', key, now).reason).toBe('consumed');
    expect(evaluateOtp(challenge({attempts: 5}), '123456', key, now).reason).toBe('attempts_exceeded');
  });

  it('rejects an incorrect OTP without revealing it', () => {
    expect(evaluateOtp(challenge(), '000000', key, now).reason).toBe('invalid');
  });
});

describe('role and ownership policy', () => {
  it('allows only the job owner or admin to manage a job', () => {
    expect(canManageJob('employer-1', 'employer', 'employer-1', false)).toBe(true);
    expect(canManageJob('employer-2', 'employer', 'employer-1', false)).toBe(false);
    expect(canManageJob('admin-1', 'admin', 'employer-1', false)).toBe(true);
    expect(canManageJob('employer-1', 'employer', 'employer-1', true)).toBe(false);
  });

  it('allows workers and employers to manage only their own pending applications', () => {
    expect(canManageApplicationAsWorker('worker-1', 'worker', 'worker-1', 'pending', false)).toBe(true);
    expect(canManageApplicationAsWorker('worker-2', 'worker', 'worker-1', 'pending', false)).toBe(false);
    expect(canManageApplicationAsEmployer('employer-1', 'employer', 'employer-1', 'pending', false)).toBe(true);
    expect(canManageApplicationAsEmployer('employer-1', 'employer', 'employer-1', 'accepted', false)).toBe(false);
  });

  it('prevents duplicate applications with a deterministic document id', () => {
    const id = applicationDocumentId('job-1', 'worker-1');
    expect(id).toBe('job-1:worker-1');
    expect(isDuplicateApplication(id, 'job-1', 'worker-1')).toBe(true);
    expect(isDuplicateApplication('job-1:worker-2', 'job-1', 'worker-1')).toBe(false);
  });

  it('blocks inactive actors', () => {
    expect(isActiveActor('worker', false)).toBe(true);
    expect(isActiveActor('worker', true)).toBe(false);
    expect(isActiveActor('admin', false)).toBe(true);
  });
});
