import {db} from './config';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

const COLLECTION = 'rateLimits';

export async function consumeRateLimit(key: string, now = Date.now()): Promise<RateLimitResult> {
  const docRef = db.collection(COLLECTION).doc(key);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(docRef);
    const current = snapshot.data() as {count?: number; windowStart?: number} | undefined;
    const windowStart = typeof current?.windowStart === 'number' ? current.windowStart : now;
    const count = typeof current?.count === 'number' && now - windowStart < 10 * 60 * 1000 ? current.count : 0;
    if (count >= 5) {
      return {allowed: false, remaining: 0, resetAt: windowStart + 10 * 60 * 1000};
    }
    transaction.set(docRef, {count: count + 1, windowStart}, {merge: true});
    return {allowed: true, remaining: 5 - (count + 1), resetAt: windowStart + 10 * 60 * 1000};
  });
}
