import {getAuth, type DecodedIdToken, type UserRecord} from 'firebase-admin/auth';
import {
  getFirestore,
  type DocumentData,
  type DocumentSnapshot,
  type Firestore,
  type Query,
  type QueryDocumentSnapshot,
  FieldValue,
  Timestamp,
  type Transaction,
} from 'firebase-admin/firestore';
import {getMessaging} from 'firebase-admin/messaging';
import {document} from 'firebase-functions/v1/firestore';
import {onRequest, type Request as FunctionsRequest} from 'firebase-functions/v1/https';
import type {Change} from 'firebase-functions/lib/common/change';
import type {Response as ExpressResponse, Request as ExpressRequest} from 'express';
import {generateOtp, hashEmail, hashOtp, hashValue, isValidEmail, isValidRole, normalizeEmail, otpMatches} from './otp';
import {consumeRateLimit} from './rateLimit';
import {sendOtpEmail} from './email';
import {secrets} from './config';

const OTP_COLLECTION = 'otpChallenges';
const USERS_COLLECTION = 'users';
const JOBS_COLLECTION = 'jobs';
const APPLICATIONS_COLLECTION = 'applications';
const NOTIFICATIONS_COLLECTION = 'notifications';
const REPORTS_COLLECTION = 'reports';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Client-Version',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

type Role = 'employer' | 'worker';
type Language = 'en' | 'hi';

interface OtpChallengeRecord {
  emailHash: string;
  role: Role;
  otpHash: string;
  expiresAt: number;
  attempts: number;
  consumed: boolean;
  createdAt: number;
  resentAt?: number;
  verifiedAt?: number;
}

interface UserProfileRecord {
  uid: string;
  role: Role;
  email: string;
  name: string;
  phone?: string;
  profilePhoto?: string;
  age?: number;
  gender?: string;
  address?: string;
  location?: string;
  skills: string[];
  experience?: number;
  preferredCategories: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isBlocked: boolean;
}

interface AuthUserView {
  uid: string;
  email: string;
  role: Role;
  name: string;
  profilePhoto?: string;
  isAdmin: boolean;
}

interface VerificationOutcome {
  ok: boolean;
  reason: 'invalid' | 'expired' | 'attempts_exceeded';
}

class HttpError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

const db = getFirestore();
const auth = getAuth();
const messaging = getMessaging();

function setCors(response: ExpressResponse): void {
  Object.entries(CORS_HEADERS).forEach(([key, value]) => response.set(key, value));
}

function json(response: ExpressResponse, status: number, payload: unknown): void {
  response.status(status).json(payload);
}

function errorMessage(language: Language, code: string): string {
  const hindi: Record<string, string> = {
    invalid_request: 'अनुरोध अमान्य है।',
    rate_limited: 'बहुत ज़्यादा प्रयास हुए। कृपया कुछ देर बाद प्रयास करें।',
    otp_invalid: 'OTP सही नहीं है।',
    otp_expired: 'OTP समाप्त हो गया है। नया OTP मंगाएँ।',
    otp_attempts_exceeded: 'बहुत ज़्यादा गलत प्रयास हुए। नया OTP मंगाएँ।',
    role_mismatch: 'चुना गया role इस account के लिए सही नहीं है।',
    blocked_account: 'यह account अभी उपलब्ध नहीं है।',
    service_unavailable: 'सेवा अस्थायी रूप से उपलब्ध नहीं है।',
    unauthorized: 'इस कार्रवाई के लिए अनुमति नहीं है।',
  };
  return hindi[code] ?? 'कुछ गलत हुआ। कृपया थोड़ी देर बाद प्रयास करें।';
}

function sendError(response: ExpressResponse, language: Language, error: unknown): void {
  if (error instanceof HttpError) {
    json(response, error.status, {error: {code: error.code, message: errorMessage(language, error.code)}});
    return;
  }
  console.error('DailyHire request failed', {name: error instanceof Error ? error.name : 'unknown'});
  json(response, 500, {error: {code: 'service_unavailable', message: errorMessage(language, 'service_unavailable')}});
}

async function readBody(request: ExpressRequest): Promise<Record<string, unknown>> {
  const body = request.body as unknown;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'invalid_request', 'Invalid request');
  }
  return body as Record<string, unknown>;
}

function readString(body: Record<string, unknown>, field: string): string {
  const value = body[field];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new HttpError(400, 'invalid_request', 'Invalid request');
  }
  return value.trim();
}

function readLanguage(body: Record<string, unknown>): Language {
  return body.language === 'hi' ? 'hi' : 'en';
}

function readRole(body: Record<string, unknown>): Role {
  const candidate = body.role;
  const value = typeof candidate === 'string' ? candidate : '';
  if (!isValidRole(value)) {
    throw new HttpError(400, 'invalid_request', 'Invalid request');
  }
  return value;
}

function requestIp(request: ExpressRequest): string {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim() ?? 'unknown';
  }
  return request.ip ?? 'unknown';
}

function rateKey(request: ExpressRequest, emailHash: string, purpose: 'request' | 'verify'): string {
  return hashValue(`${purpose}:${requestIp(request)}:${emailHash}`, secrets.otpHashKey);
}

function isNotFoundAuthError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'auth/user-not-found';
}

async function getOrCreateUser(email: string, role: Role): Promise<{user: UserRecord; profile: UserProfileRecord}> {
  let user: UserRecord;
  try {
    user = await auth.getUserByEmail(email);
    const existingRole = user.customClaims?.role;
    if (existingRole !== undefined && existingRole !== role) {
      throw new HttpError(409, 'role_mismatch', 'Role mismatch');
    }
    if (existingRole === undefined) {
      await auth.setCustomUserClaims(user.uid, {role, dailyHire: true});
    }
    if (user.disabled) {
      throw new HttpError(403, 'blocked_account', 'Blocked account');
    }
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    if (isNotFoundAuthError(error)) {
      user = await auth.createUser({email, emailVerified: true, disabled: false});
      await auth.setCustomUserClaims(user.uid, {role, dailyHire: true});
    } else {
      throw error;
    }
  }

  const profileRef = db.collection(USERS_COLLECTION).doc(user.uid);
  const now = Timestamp.now();
  const profile = await db.runTransaction(async (transaction: Transaction) => {
    const snapshot = await transaction.get(profileRef);
    if (snapshot.exists) {
      const existing = snapshot.data() as UserProfileRecord;
      if (existing.role !== role || existing.email !== email || existing.isBlocked === true) {
        if (existing.isBlocked === true) {
          throw new HttpError(403, 'blocked_account', 'Blocked account');
        }
        throw new HttpError(409, 'role_mismatch', 'Role mismatch');
      }
      return existing;
    }
    const next: UserProfileRecord = {
      uid: user.uid,
      role,
      email,
      name: '',
      skills: [],
      preferredCategories: [],
      createdAt: now,
      updatedAt: now,
      isBlocked: false,
    };
    transaction.set(profileRef, next);
    return next;
  });
  return {user, profile};
}

export const requestEmailOtp = onRequest(async (request, response) => {
  setCors(response);
  if (request.method === 'OPTIONS') {
    response.sendStatus(204);
    return;
  }
  let language: Language = 'en';
  try {
    if (request.method !== 'POST') {
      throw new HttpError(405, 'invalid_request', 'Method not allowed');
    }
    language = readLanguage(request.body as Record<string, unknown>);
    const body = await readBody(request);
    const email = normalizeEmail(readString(body, 'email'));
    const role = readRole(body);
    if (!isValidEmail(email)) {
      throw new HttpError(400, 'invalid_request', 'Invalid email');
    }
    const emailHash = hashEmail(email, secrets.otpHashKey);
    const limit = await consumeRateLimit(rateKey(request, emailHash, 'request'));
    if (!limit.allowed) {
      throw new HttpError(429, 'rate_limited', 'Rate limited');
    }
    const now = Date.now();
    const challengeRef = db.collection(OTP_COLLECTION).doc(emailHash);
    const otp = generateOtp();
    const challenge = await db.runTransaction(async (transaction: Transaction) => {
      const snapshot = await transaction.get(challengeRef);
      const existing = snapshot.data() as OtpChallengeRecord | undefined;
      if (existing && !existing.consumed && !existing.verifiedAt && existing.expiresAt > now) {
        const lastSent = existing.resentAt ?? existing.createdAt;
        if (now - lastSent < 60_000) {
          return {challenge: existing, cooldown: true};
        }
      }
      const next: OtpChallengeRecord = {
        emailHash,
        role,
        otpHash: hashOtp(otp, secrets.otpHashKey),
        expiresAt: now + 600_000,
        attempts: 0,
        consumed: false,
        createdAt: now,
        resentAt: now,
      };
      transaction.set(challengeRef, next);
      return {challenge: next, cooldown: false};
    });
    if (!challenge.cooldown) {
      await sendOtpEmail(email, otp, language);
    }
    json(response, 200, {sent: !challenge.cooldown, expiresInSeconds: 600, resendAfterSeconds: 60, maxAttempts: 5});
  } catch (error) {
    sendError(response, language, error);
  }
});

export const verifyEmailOtp = onRequest(async (request, response) => {
  setCors(response);
  if (request.method === 'OPTIONS') {
    response.sendStatus(204);
    return;
  }
  let language: Language = 'en';
  try {
    if (request.method !== 'POST') {
      throw new HttpError(405, 'invalid_request', 'Method not allowed');
    }
    language = readLanguage(request.body as Record<string, unknown>);
    const body = await readBody(request);
    const email = normalizeEmail(readString(body, 'email'));
    const role = readRole(body);
    const otp = readString(body, 'otp');
    if (!isValidEmail(email) || !/^\d{6}$/.test(otp)) {
      throw new HttpError(400, 'invalid_request', 'Invalid request');
    }
    const emailHash = hashEmail(email, secrets.otpHashKey);
    const limit = await consumeRateLimit(rateKey(request, emailHash, 'verify'));
    if (!limit.allowed) {
      throw new HttpError(429, 'rate_limited', 'Rate limited');
    }
    const challengeRef = db.collection(OTP_COLLECTION).doc(emailHash);
    const outcome = await db.runTransaction(async (transaction: Transaction): Promise<VerificationOutcome> => {
      const snapshot = await transaction.get(challengeRef);
      const current = snapshot.data() as OtpChallengeRecord | undefined;
      if (!current || current.consumed || current.role !== role) {
        return {ok: false, reason: 'invalid'};
      }
      if (current.expiresAt <= Date.now()) {
        transaction.update(challengeRef, {consumed: true, verifiedAt: null});
        return {ok: false, reason: 'expired'};
      }
      if (current.attempts >= 5) {
        return {ok: false, reason: 'attempts_exceeded'};
      }
      if (!otpMatches(otp, current.otpHash, secrets.otpHashKey)) {
        transaction.update(challengeRef, {attempts: FieldValue.increment(1)});
        return {ok: false, reason: current.attempts + 1 >= 5 ? 'attempts_exceeded' : 'invalid'};
      }
      transaction.update(challengeRef, {consumed: true, verifiedAt: Date.now()});
      return {ok: true, reason: 'invalid'};
    });
    if (!outcome.ok) {
      const status = outcome.reason === 'attempts_exceeded' ? 429 : outcome.reason === 'expired' ? 400 : 400;
      const code = outcome.reason === 'attempts_exceeded' ? 'otp_attempts_exceeded' : outcome.reason === 'expired' ? 'otp_expired' : 'otp_invalid';
      throw new HttpError(status, code, code);
    }
    const {user, profile} = await getOrCreateUser(email, role);
    const idToken = await auth.createCustomToken(user.uid, {role, dailyHire: true});
    const view: AuthUserView = {
      uid: user.uid,
      email: user.email ?? email,
      role,
      name: profile.name,
      ...(profile.profilePhoto ? {profilePhoto: profile.profilePhoto} : {}),
      isAdmin: user.customClaims?.admin === true,
    };
    json(response, 200, {customToken: idToken, user: view});
  } catch (error) {
    sendError(response, language, error);
  }
});

export const saveFcmToken = onRequest(async (request, response) => {
  setCors(response);
  if (request.method === 'OPTIONS') {
    response.sendStatus(204);
    return;
  }
  try {
    const token = await authToken(request);
    if (request.method !== 'POST') throw new HttpError(405, 'invalid_request', 'Method not allowed');
    const body = await readBody(request);
    const fcmToken = readString(body, 'token');
    if (fcmToken.length > 4096) throw new HttpError(400, 'invalid_request', 'Invalid token');
    await db.collection(USERS_COLLECTION).doc(token.uid).collection('fcmTokens').doc(hashValue(fcmToken, secrets.otpHashKey)).set({
      token: fcmToken,
      updatedAt: FieldValue.serverTimestamp(),
    }, {merge: true});
    json(response, 200, {saved: true});
  } catch (error) {
    sendError(response, 'en', error);
  }
});

async function authToken(request: ExpressRequest): Promise<DecodedIdToken> {
  const header = request.headers.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
    throw new HttpError(401, 'unauthorized', 'Unauthorized');
  }
  try {
    return await auth.verifyIdToken(header.slice(7));
  } catch {
    throw new HttpError(401, 'unauthorized', 'Unauthorized');
  }
}

function requireAdmin(token: DecodedIdToken): void {
  if (token.admin !== true) throw new HttpError(403, 'unauthorized', 'Unauthorized');
}

export const adminOverview = onRequest(async (request, response) => {
  setCors(response);
  try {
    const token = await authToken(request);
    requireAdmin(token);
    const [users, jobs, applications, reports] = await Promise.all([
      db.collection(USERS_COLLECTION).count().get(),
      db.collection(JOBS_COLLECTION).count().get(),
      db.collection(APPLICATIONS_COLLECTION).count().get(),
      db.collection(REPORTS_COLLECTION).where('status', '!=', 'resolved').count().get(),
    ]);
    json(response, 200, {users: users.data().count, employers: 0, workers: 0, jobs: jobs.data().count, applications: applications.data().count, openReports: reports.data().count});
  } catch (error) {
    sendError(response, 'en', error);
  }
});

export const adminBlockUser = onRequest(async (request, response) => {
  setCors(response);
  try {
    const token = await authToken(request);
    requireAdmin(token);
    if (request.method !== 'POST') throw new HttpError(405, 'invalid_request', 'Method not allowed');
    const body = await readBody(request);
    const uid = readString(body, 'uid');
    const blocked = body.blocked === true;
    await db.collection(USERS_COLLECTION).doc(uid).set({isBlocked: blocked, updatedAt: FieldValue.serverTimestamp()}, {merge: true});
    json(response, 200, {updated: true});
  } catch (error) {
    sendError(response, 'en', error);
  }
});

interface BackendJobView {
  jobId: string;
  employerId: string;
  title: string;
  category: string;
  description: string;
  location: string;
  salary: number;
  salaryUnit: 'daily' | 'hourly' | 'fixed';
  workingHours: string;
  workersNeeded: number;
  startDate: string;
  status: 'draft' | 'open' | 'closed' | 'filled';
  featured: boolean;
  createdAt: string;
  updatedAt: string;
  contactNumber?: string;
}

interface BackendApplicationView {
  applicationId: string;
  jobId: string;
  workerId: string;
  employerId: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  appliedAt: string;
  updatedAt: string;
}

interface BackendReportView {
  reportId: string;
  reportedBy: string;
  targetUid: string;
  reason: string;
  status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
  createdAt: string;
}

function readOptionalString(data: DocumentData, field: string): string | undefined {
  return typeof data[field] === 'string' && data[field] ? data[field] : undefined;
}

function readRequiredString(data: DocumentData, field: string): string {
  return typeof data[field] === 'string' ? data[field] : '';
}

function readRequiredNumber(data: DocumentData, field: string): number {
  return typeof data[field] === 'number' && Number.isFinite(data[field]) ? data[field] : 0;
}

function readDateValue(value: unknown): string {
  if (value && typeof value === 'object' && 'toDate' in value) {
    const candidate = value as {toDate?: unknown};
    if (typeof candidate.toDate === 'function') return (candidate.toDate() as Date).toISOString();
  }
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

function jobFromDocument(id: string, data: DocumentData): BackendJobView {
  const contactNumber = readOptionalString(data, 'contactNumber');
  return {
    jobId: readRequiredString(data, 'jobId') || id,
    employerId: readRequiredString(data, 'employerId'),
    title: readRequiredString(data, 'title'),
    category: readRequiredString(data, 'category'),
    description: readRequiredString(data, 'description'),
    location: readRequiredString(data, 'location'),
    salary: readRequiredNumber(data, 'salary'),
    salaryUnit: ['daily', 'hourly', 'fixed'].includes(data.salaryUnit) ? data.salaryUnit : 'daily',
    workingHours: readRequiredString(data, 'workingHours'),
    workersNeeded: readRequiredNumber(data, 'workersNeeded'),
    startDate: readDateValue(data.startDate),
    status: ['draft', 'open', 'closed', 'filled'].includes(data.status) ? data.status : 'draft',
    featured: data.featured === true,
    createdAt: readDateValue(data.createdAt),
    updatedAt: readDateValue(data.updatedAt),
    ...(contactNumber ? {contactNumber} : {}),
  };
}

function applicationFromDocument(id: string, data: DocumentData): BackendApplicationView {
  return {
    applicationId: readRequiredString(data, 'applicationId') || id,
    jobId: readRequiredString(data, 'jobId'),
    workerId: readRequiredString(data, 'workerId'),
    employerId: readRequiredString(data, 'employerId'),
    status: ['pending', 'accepted', 'rejected', 'cancelled'].includes(data.status) ? data.status : 'pending',
    appliedAt: readDateValue(data.appliedAt),
    updatedAt: readDateValue(data.updatedAt),
  };
}

function reportFromDocument(id: string, data: DocumentData): BackendReportView {
  return {
    reportId: readRequiredString(data, 'reportId') || id,
    reportedBy: readRequiredString(data, 'reportedBy'),
    targetUid: readRequiredString(data, 'targetUid'),
    reason: readRequiredString(data, 'reason'),
    status: ['open', 'reviewing', 'resolved', 'dismissed'].includes(data.status) ? data.status : 'open',
    createdAt: readDateValue(data.createdAt),
  };
}

async function requireActiveActor(token: DecodedIdToken): Promise<void> {
  const profile = await db.collection(USERS_COLLECTION).doc(token.uid).get();
  if (!profile.exists || profile.data()?.isBlocked === true) {
    throw new HttpError(403, 'blocked_account', 'Blocked account');
  }
}

export const searchJobs = onRequest(async (request, response) => {
  setCors(response);
  try {
    const token = await authToken(request);
    await requireActiveActor(token);
    if (request.method !== 'POST') throw new HttpError(405, 'invalid_request', 'Method not allowed');
    const body = await readBody(request);
    const filters = body.filters && typeof body.filters === 'object' ? body.filters as Record<string, unknown> : {};
    const pageSize = typeof body.pageSize === 'number' && body.pageSize > 0 ? Math.min(Math.floor(body.pageSize), 50) : 25;
    const constraints: FirebaseFirestore.WhereFilterOp[] = [];
    void constraints;
    let firestoreQuery: Query = db.collection(JOBS_COLLECTION)
      .where('status', '==', 'open')
      .orderBy('createdAt', 'desc');
    const category = typeof filters.category === 'string' && filters.category && filters.category !== 'All' ? filters.category : undefined;
    const location = typeof filters.location === 'string' && filters.location.trim() ? filters.location.trim() : undefined;
    const minSalary = typeof filters.minSalary === 'number' ? filters.minSalary : undefined;
    const maxSalary = typeof filters.maxSalary === 'number' ? filters.maxSalary : undefined;
    const startDate = typeof filters.startDate === 'string' && filters.startDate ? filters.startDate : undefined;
    if (category) firestoreQuery = firestoreQuery.where('category', '==', category);
    if (location) firestoreQuery = firestoreQuery.where('location', '==', location);
    if (minSalary !== undefined) firestoreQuery = firestoreQuery.where('salary', '>=', minSalary);
    if (maxSalary !== undefined) firestoreQuery = firestoreQuery.where('salary', '<=', maxSalary);
    if (startDate) firestoreQuery = firestoreQuery.where('startDate', '>=', startDate);
    if (typeof filters.query === 'string' && filters.query.trim()) {
      const prefix = filters.query.trim().toLowerCase();
      firestoreQuery = firestoreQuery.where('searchText', '>=', prefix).where('searchText', '<=', `${prefix}\uf8ff`);
    }
    if (typeof body.cursor === 'string' && body.cursor) {
      const cursor = await db.collection(JOBS_COLLECTION).doc(body.cursor).get();
      if (cursor.exists) firestoreQuery = firestoreQuery.startAfter(cursor);
    }
    const snapshot = await firestoreQuery.limit(pageSize + 1).get();
    const docs = snapshot.docs;
    const hasMore = docs.length > pageSize;
    const visibleDocs = hasMore ? docs.slice(0, pageSize) : docs;
    json(response, 200, {
      items: visibleDocs.map(document => jobFromDocument(document.id, document.data())),
      ...(visibleDocs.length > 0 ? {nextCursor: visibleDocs[visibleDocs.length - 1]?.id} : {}),
      hasMore,
    });
  } catch (error) {
    sendError(response, 'en', error);
  }
});

async function listAdminDocuments<T>(
  collectionName: string,
  mapDocument: (id: string, data: DocumentData) => T,
  request: ExpressRequest,
  pageSize = 50,
): Promise<{items: T[]; nextCursor?: string; hasMore: boolean}> {
  let query: Query = db.collection(collectionName).orderBy('createdAt', 'desc');
  const body = await readBody(request);
  if (typeof body.cursor === 'string' && body.cursor) {
    const cursor = await db.collection(collectionName).doc(body.cursor).get();
    if (cursor.exists) query = query.startAfter(cursor);
  }
  const snapshot = await query.limit(pageSize + 1).get();
  const docs = snapshot.docs;
  const hasMore = docs.length > pageSize;
  const visibleDocs = hasMore ? docs.slice(0, pageSize) : docs;
  const result = {
    items: visibleDocs.map(document => mapDocument(document.id, document.data())),
    hasMore,
  };
  const nextCursor = visibleDocs.length > 0 ? visibleDocs[visibleDocs.length - 1]?.id : undefined;
  return nextCursor ? {...result, nextCursor} : result;
}

export const adminUsers = onRequest(async (request, response) => {
  setCors(response);
  try {
    const token = await authToken(request);
    requireAdmin(token);
    const result = await listAdminDocuments(USERS_COLLECTION, (id, data) => ({
      uid: id,
      role: data.role,
      email: data.email,
      name: data.name,
      isBlocked: data.isBlocked === true,
      createdAt: readDateValue(data.createdAt),
    }), request);
    json(response, 200, result);
  } catch (error) {
    sendError(response, 'en', error);
  }
});

export const adminJobs = onRequest(async (request, response) => {
  setCors(response);
  try {
    const token = await authToken(request);
    requireAdmin(token);
    json(response, 200, await listAdminDocuments(JOBS_COLLECTION, jobFromDocument, request));
  } catch (error) {
    sendError(response, 'en', error);
  }
});

export const adminApplications = onRequest(async (request, response) => {
  setCors(response);
  try {
    const token = await authToken(request);
    requireAdmin(token);
    json(response, 200, await listAdminDocuments(APPLICATIONS_COLLECTION, applicationFromDocument, request));
  } catch (error) {
    sendError(response, 'en', error);
  }
});

export const adminReports = onRequest(async (request, response) => {
  setCors(response);
  try {
    const token = await authToken(request);
    requireAdmin(token);
    json(response, 200, await listAdminDocuments(REPORTS_COLLECTION, reportFromDocument, request));
  } catch (error) {
    sendError(response, 'en', error);
  }
});

export const adminRemoveJob = onRequest(async (request, response) => {
  setCors(response);
  try {
    const token = await authToken(request);
    requireAdmin(token);
    if (request.method !== 'POST') throw new HttpError(405, 'invalid_request', 'Method not allowed');
    const body = await readBody(request);
    const jobId = readString(body, 'jobId');
    await db.collection(JOBS_COLLECTION).doc(jobId).delete();
    json(response, 200, {removed: true});
  } catch (error) {
    sendError(response, 'en', error);
  }
});

export const createReport = onRequest(async (request, response) => {
  setCors(response);
  try {
    const token = await authToken(request);
    await requireActiveActor(token);
    if (request.method !== 'POST') throw new HttpError(405, 'invalid_request', 'Method not allowed');
    const body = await readBody(request);
    const targetUid = readString(body, 'targetUid');
    const reason = readString(body, 'reason');
    if (targetUid === token.uid) throw new HttpError(400, 'invalid_request', 'Invalid report');
    const reportId = db.collection(REPORTS_COLLECTION).doc().id;
    await db.collection(REPORTS_COLLECTION).doc(reportId).set({
      reportId,
      reportedBy: token.uid,
      targetUid,
      reason,
      status: 'open',
      createdAt: FieldValue.serverTimestamp(),
    });
    json(response, 201, {reportId});
  } catch (error) {
    sendError(response, 'en', error);
  }
});

async function createNotification(input: {recipientUid: string; type: string; title: string; body: string; actionType?: string; actionId?: string}): Promise<void> {
  const notification = {
    notificationId: db.collection(NOTIFICATIONS_COLLECTION).doc().id,
    recipientUid: input.recipientUid,
    type: input.type,
    title: input.title,
    body: input.body,
    read: false,
    ...(input.actionType ? {actionType: input.actionType} : {}),
    ...(input.actionId ? {actionId: input.actionId} : {}),
    createdAt: FieldValue.serverTimestamp(),
  };
  await db.collection(NOTIFICATIONS_COLLECTION).add(notification);
  const tokens = await db.collection(USERS_COLLECTION).doc(input.recipientUid).collection('fcmTokens').get();
  const messages = tokens.docs
    .map((snapshot) => snapshot.data().token)
    .filter((token): token is string => typeof token === 'string')
    .map((token) => ({token, notification: {title: input.title, body: input.body, data: {type: input.type, actionId: input.actionId ?? ''}}}));
  for (const message of messages) {
    try {
      await messaging.send(message);
    } catch (error) {
      console.error('FCM delivery failed', {name: error instanceof Error ? error.name : 'unknown'});
    }
  }
}

function applicationNotification(change: Change<DocumentSnapshot>): Promise<void> | null {
  if (!change.after.exists) return null;
  const afterData = change.after.data();
  if (!afterData) return null;
  const after = afterData;
  const before = change.before.exists ? change.before.data() : undefined;
  if (before?.status === after.status) return null;
  const recipientUid = after.status === 'pending' ? after.employerId : after.workerId;
  if (typeof recipientUid !== 'string') return null;
  const title = after.status === 'pending' ? 'Application received' : after.status === 'accepted' ? 'Application accepted' : after.status === 'rejected' ? 'Application rejected' : 'Application update';
  return createNotification({
    recipientUid,
    type: after.status === 'pending' ? 'application_received' : after.status === 'accepted' ? 'application_accepted' : after.status === 'rejected' ? 'application_rejected' : 'account',
    title,
    body: `Application ${after.status}`,
    actionType: 'application',
    actionId: change.after.id,
  });
}

export const onApplicationChanged = document('applications/{applicationId}').onWrite((change) => {
  return applicationNotification(change) ?? null;
});

export const onJobChanged = document('jobs/{jobId}').onWrite((change) => {
  const after = change.after.exists ? change.after.data() : undefined;
  const before = change.before.exists ? change.before.data() : undefined;
  if (!after || before?.status === after.status || after.status !== 'closed') return null;
  return createNotification({
    recipientUid: after.employerId,
    type: 'job_closed',
    title: 'Job closed',
    body: 'One of your jobs was closed.',
    actionType: 'job',
    actionId: change.after.id,
  });
});
