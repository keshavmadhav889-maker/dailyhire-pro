import {
  getAuth as getFirebaseAuth,
  onAuthStateChanged,
  signInWithCustomToken,
  signOut,
  type User,
} from '@react-native-firebase/auth';
import {
  collection,
  deleteField,
  doc,
  getDoc,
  getFirestore as getFirebaseFirestore,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentData,
} from '@react-native-firebase/firestore';
import {ENDPOINTS, LIMITS} from '../../constants';
import {
  AuthenticatedUser,
  EmployerProfile,
  Gender,
  JobCategory,
  ProfileFormValues,
  UserProfile,
} from '../../types';
import {callBackend} from '../../utils/api';
import {AppError} from '../../utils/errors';
import {clearPendingRole, getPendingRole} from '../../utils/storage';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface EmailOtpRequestResult {
  expiresInSeconds: number;
  resendAfterSeconds: number;
  maxAttempts: number;
}

export interface AuthSession {
  user: AuthenticatedUser;
  profile: UserProfile;
  idToken: string;
}

export interface AuthContextValue {
  session: AuthSession | null;
  loading: boolean;
  initialized: boolean;
  requestOtp: (
    email: string,
    role: 'employer' | 'worker',
    language: 'en' | 'hi',
  ) => Promise<EmailOtpRequestResult>;
  verifyOtp: (
    email: string,
    otp: string,
    role: 'employer' | 'worker',
    language: 'en' | 'hi',
  ) => Promise<AuthSession>;
  restoreSession: () => Promise<AuthSession | null>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<AuthSession | null>;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function assertEmail(email: string): string {
  const normalized = normalizeEmail(email);
  if (!EMAIL_PATTERN.test(normalized) || normalized.length > 254) {
    throw new AppError('email_invalid', 'email_invalid', false);
  }
  return normalized;
}

function assertOtp(otp: string): string {
  const value = otp.replace(/\s/g, '');
  if (!new RegExp(`^\\d{${LIMITS.otpLength}}$`).test(value)) {
    throw new AppError('otp_invalid', 'otp_invalid', false);
  }
  return value;
}

function readString(data: DocumentData, field: string): string {
  return typeof data[field] === 'string' ? data[field] : '';
}

function readNumber(data: DocumentData, field: string): number | undefined {
  return typeof data[field] === 'number' && Number.isFinite(data[field]) ? data[field] : undefined;
}

function readStringArray(data: DocumentData, field: string): string[] {
  return Array.isArray(data[field])
    ? data[field].filter((item): item is string => typeof item === 'string')
    : [];
}

function readCategoryArray(data: DocumentData, field: string): JobCategory[] {
  const categories: JobCategory[] = [
    'Construction',
    'Farming',
    'Delivery',
    'Helper',
    'Electrician',
    'Plumber',
    'Driver',
    'Loader',
    'Agriculture Labour',
    'Other',
  ];
  return readStringArray(data, field).filter(
    (value): value is JobCategory => categories.includes(value as JobCategory),
  );
}

function readGender(value: unknown): Gender | undefined {
  const allowed: Gender[] = ['female', 'male', 'other', 'prefer_not_to_say'];
  return typeof value === 'string' && allowed.includes(value as Gender)
    ? (value as Gender)
    : undefined;
}

function readRole(value: unknown): UserProfile['role'] | undefined {
  return value === 'worker' || value === 'employer' || value === 'admin'
    ? value
    : undefined;
}

function readDate(value: unknown, fallback = new Date()): Date {
  if (value && typeof value === 'object' && 'toDate' in value) {
    const candidate = value as {toDate?: unknown};
    if (typeof candidate.toDate === 'function') {
      return candidate.toDate() as Date;
    }
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.valueOf()) ? fallback : parsed;
  }
  return fallback;
}

export function profileFromDocument(uid: string, data: DocumentData): UserProfile {
  const role = readRole(data.role) ?? 'worker';
  const createdAt = readDate(data.createdAt);
  const updatedAt = readDate(data.updatedAt, createdAt);
  const base: UserProfile = {
    uid,
    role,
    email: readString(data, 'email'),
    name: readString(data, 'name') || readString(data, 'displayName') || uid,
    skills: readStringArray(data, 'skills'),
    preferredCategories: readCategoryArray(data, 'preferredCategories'),
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
    isBlocked: data.isBlocked === true,
  };
  return {
    ...base,
    ...(typeof data.phone === 'string' && data.phone ? {phone: data.phone} : {}),
    ...(typeof data.profilePhoto === 'string' && data.profilePhoto
      ? {profilePhoto: data.profilePhoto}
      : {}),
    ...(readNumber(data, 'age') !== undefined ? {age: readNumber(data, 'age')} : {}),
    ...(readGender(data.gender) ? {gender: readGender(data.gender)} : {}),
    ...(typeof data.address === 'string' && data.address ? {address: data.address} : {}),
    ...(typeof data.location === 'string' && data.location ? {location: data.location} : {}),
    ...(readNumber(data, 'experience') !== undefined
      ? {experience: readNumber(data, 'experience')}
      : {}),
    ...(Array.isArray(data.fcmTokens)
      ? {fcmTokens: data.fcmTokens.filter((token): token is string => typeof token === 'string')}
      : {}),
    ...(role === 'employer' && typeof data.businessName === 'string' && data.businessName
      ? {businessName: data.businessName}
      : {}),
  } as UserProfile;
}

function authenticatedUserFromFirebase(
  firebaseUser: User,
  profile: UserProfile,
  isAdmin: boolean,
): AuthenticatedUser {
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email || profile.email,
    role: profile.role,
    ...(profile.name ? {name: profile.name} : {}),
    ...(profile.profilePhoto ? {profilePhoto: profile.profilePhoto} : {}),
    ...(firebaseUser.displayName ? {name: firebaseUser.displayName} : {}),
    ...(firebaseUser.photoURL ? {profilePhoto: firebaseUser.photoURL} : {}),
    ...(isAdmin ? {isAdmin: true} : {}),
  };
}

async function readProfile(uid: string): Promise<UserProfile | null> {
  const snapshot = await getDoc(doc(getFirebaseFirestore(), 'users', uid));
  return snapshot.exists() ? profileFromDocument(uid, snapshot.data() ?? {}) : null;
}

async function createProfile(firebaseUser: User, role: UserProfile['role']): Promise<UserProfile> {
  const reference = doc(getFirebaseFirestore(), 'users', firebaseUser.uid);
  const snapshot = await getDoc(reference);
  if (snapshot.exists()) {
    const profile = profileFromDocument(firebaseUser.uid, snapshot.data() ?? {});
    if (profile.role !== role) {
      throw new AppError('role_mismatch', 'role_mismatch', false);
    }
    return profile;
  }
  const now = new Date().toISOString();
  const profile: UserProfile = {
    uid: firebaseUser.uid,
    role,
    email: firebaseUser.email || '',
    name: '',
    skills: [],
    preferredCategories: [],
    createdAt: now,
    updatedAt: now,
    isBlocked: false,
  };
  const documentData: Record<string, unknown> = {...profile};
  await setDoc(reference, documentData);
  return profile;
}

async function sessionFromFirebaseUser(
  firebaseUser: User,
  expectedRole?: UserProfile['role'],
): Promise<AuthSession> {
  let profile = await readProfile(firebaseUser.uid);
  if (!profile) {
    profile = await createProfile(firebaseUser, expectedRole ?? 'worker');
  }
  if (expectedRole && profile.role !== expectedRole) {
    throw new AppError('role_mismatch', 'role_mismatch', false);
  }
  if (profile.isBlocked) {
    throw new AppError('blocked_account', 'blocked_account', false);
  }
  const tokenResult = await firebaseUser.getIdTokenResult();
  const isAdmin = tokenResult.claims.admin === true;
  return {
    user: authenticatedUserFromFirebase(firebaseUser, profile, isAdmin),
    profile,
    idToken: await firebaseUser.getIdToken(),
  };
}

export async function requestEmailOtp(
  email: string,
  role: 'employer' | 'worker',
  language: 'en' | 'hi',
): Promise<EmailOtpRequestResult> {
  const normalized = assertEmail(email);
  const pendingRole = await getPendingRole();
  if (pendingRole && pendingRole !== role) {
    throw new AppError('role_mismatch', 'role_mismatch', false);
  }
  const response = await callBackend<EmailOtpRequestResult>(ENDPOINTS.requestEmailOtp, {
    body: {email: normalized, role, language},
  });
  return {
    expiresInSeconds: response.expiresInSeconds ?? LIMITS.otpExpirySeconds,
    resendAfterSeconds: response.resendAfterSeconds ?? LIMITS.otpResendCooldownSeconds,
    maxAttempts: response.maxAttempts ?? LIMITS.otpMaxAttempts,
  };
}

export async function verifyEmailOtp(
  email: string,
  otp: string,
  role: 'employer' | 'worker',
  language: 'en' | 'hi',
): Promise<AuthSession> {
  const normalized = assertEmail(email);
  const code = assertOtp(otp);
  const response = await callBackend<{customToken: string; user: AuthenticatedUser}>(
    ENDPOINTS.verifyEmailOtp,
    {body: {email: normalized, otp: code, role, language}},
  );
  if (!response.customToken || !response.user.uid) {
    throw new AppError('invalid_auth_response', 'invalid_auth_response', false);
  }
  const credential = await signInWithCustomToken(getFirebaseAuth(), response.customToken);
  const session = await sessionFromFirebaseUser(credential.user, role);
  if (session.user.role !== role) {
    throw new AppError('role_mismatch', 'role_mismatch', false);
  }
  await clearPendingRole();
  return session;
}

export async function restoreSession(): Promise<AuthSession | null> {
  const firebaseUser = getFirebaseAuth().currentUser;
  return firebaseUser ? sessionFromFirebaseUser(firebaseUser) : null;
}

export async function refreshSession(): Promise<AuthSession | null> {
  const firebaseUser = getFirebaseAuth().currentUser;
  if (!firebaseUser) return null;
  await firebaseUser.getIdToken(true);
  return sessionFromFirebaseUser(firebaseUser);
}

export async function signOutCurrentUser(): Promise<void> {
  await signOut(getFirebaseAuth());
  await clearPendingRole();
}

export function subscribeToAuthState(
  callback: (firebaseUser: User | null) => void | Promise<void>,
): () => void {
  return onAuthStateChanged(getFirebaseAuth(), firebaseUser => {
    void Promise.resolve(callback(firebaseUser)).catch(() => undefined);
  });
}

export function assertSessionRole(
  session: AuthSession | null,
  role: UserProfile['role'],
): asserts session is AuthSession {
  if (!session || session.profile.role !== role) {
    throw new AppError('unauthorized', 'unauthorized', false);
  }
}

export function assertEmployer(session: AuthSession | null): asserts session is AuthSession {
  assertSessionRole(session, 'employer');
}

export function assertWorker(session: AuthSession | null): asserts session is AuthSession {
  assertSessionRole(session, 'worker');
}

export function updateProfile(uid: string, values: ProfileFormValues): Promise<void> {
  const age = values.age.trim() ? Number(values.age) : undefined;
  const experience = values.experience.trim() ? Number(values.experience) : undefined;
  const data: Record<string, unknown> = {
    name: values.name.trim(),
    location: values.location.trim(),
    skills: values.skills
      .split(',')
      .map(value => value.trim())
      .filter(Boolean),
    preferredCategories: values.preferredCategories,
    updatedAt: serverTimestamp(),
  };
  if (values.phone.trim()) data.phone = values.phone.trim();
  else data.phone = deleteField();
  if (age !== undefined) data.age = age;
  else data.age = deleteField();
  if (values.gender) data.gender = values.gender;
  else data.gender = deleteField();
  if (values.address.trim()) data.address = values.address.trim();
  else data.address = deleteField();
  if (experience !== undefined) data.experience = experience;
  else data.experience = deleteField();
  if (values.businessName.trim()) data.businessName = values.businessName.trim();
  else data.businessName = deleteField();
  return updateDoc(doc(getFirebaseFirestore(), 'users', uid), data);
}

export function isEmailValid(email: string): boolean {
  return EMAIL_PATTERN.test(normalizeEmail(email)) && normalizeEmail(email).length <= 254;
}

export {normalizeEmail};
export const OTP_LENGTH = LIMITS.otpLength;
