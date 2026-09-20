"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateOtp = evaluateOtp;
exports.canManageJob = canManageJob;
exports.canManageApplicationAsWorker = canManageApplicationAsWorker;
exports.canManageApplicationAsEmployer = canManageApplicationAsEmployer;
exports.applicationDocumentId = applicationDocumentId;
exports.isDuplicateApplication = isDuplicateApplication;
exports.isActiveActor = isActiveActor;
const otp_1 = require("./otp");
function evaluateOtp(challenge, otp, otpHashKey, now) {
    if (!challenge || challenge.consumed)
        return { allowed: false, reason: challenge ? 'consumed' : 'invalid' };
    if (challenge.expiresAt <= now)
        return { allowed: false, reason: 'expired' };
    if (challenge.attempts >= 5)
        return { allowed: false, reason: 'attempts_exceeded' };
    if (!(0, otp_1.otpMatches)(otp, challenge.otpHash, otpHashKey))
        return { allowed: false, reason: 'invalid' };
    return { allowed: true };
}
function canManageJob(actorUid, role, employerId, blocked) {
    return !blocked && (role === 'admin' || (role === 'employer' && actorUid === employerId));
}
function canManageApplicationAsWorker(actorUid, role, workerId, status, blocked) {
    return !blocked && role === 'worker' && actorUid === workerId && status === 'pending';
}
function canManageApplicationAsEmployer(actorUid, role, employerId, status, blocked) {
    return !blocked && role === 'employer' && actorUid === employerId && status === 'pending';
}
function applicationDocumentId(jobId, workerId) {
    return `${jobId}:${workerId}`;
}
function isDuplicateApplication(existingApplicationId, jobId, workerId) {
    return existingApplicationId === applicationDocumentId(jobId, workerId);
}
function isActiveActor(role, blocked) {
    return !blocked && (role === 'employer' || role === 'worker' || role === 'admin');
}
//# sourceMappingURL=authPolicy.js.map