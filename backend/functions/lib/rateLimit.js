"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.consumeRateLimit = consumeRateLimit;
const config_1 = require("./config");
const COLLECTION = 'rateLimits';
async function consumeRateLimit(key, now = Date.now()) {
    const docRef = config_1.db.collection(COLLECTION).doc(key);
    return config_1.db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(docRef);
        const current = snapshot.data();
        const windowStart = typeof current?.windowStart === 'number' ? current.windowStart : now;
        const count = typeof current?.count === 'number' && now - windowStart < 10 * 60 * 1000 ? current.count : 0;
        if (count >= 5) {
            return { allowed: false, remaining: 0, resetAt: windowStart + 10 * 60 * 1000 };
        }
        transaction.set(docRef, { count: count + 1, windowStart }, { merge: true });
        return { allowed: true, remaining: 5 - (count + 1), resetAt: windowStart + 10 * 60 * 1000 };
    });
}
//# sourceMappingURL=rateLimit.js.map