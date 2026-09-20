import type {Language, NotificationType} from '../types';

export const APP_NAME = 'DailyHire';
export const APP_TAGLINE = 'Gaav ka Apna Rozgar App';
export const SUPPORTED_LANGUAGES: Language[] = ['en', 'hi'];
export const DEFAULT_LANGUAGE: Language = 'en';

export const COLORS = {
  primary: '#14532D',
  primaryDark: '#0F3D2E',
  primaryLight: '#E8F5EC',
  accent: '#FACC15',
  accentDark: '#CA8A04',
  background: '#F5F7F5',
  success: '#166534',
  danger: '#B91C1C',
  warning: '#B45309',
  text: '#17211B',
  muted: '#667069',
  border: '#D7DED9',
  card: '#FFFFFF',
  earth: '#F3EFE7',
  white: '#FFFFFF',
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
} as const;

export const LIMITS = {
  otpLength: 6,
  otpExpirySeconds: 600,
  otpMaxAttempts: 5,
  otpResendCooldownSeconds: 60,
  jobPageSize: 12,
  notificationPageSize: 20,
  applicantPageSize: 20,
  maxProfilePhotoBytes: 5 * 1024 * 1024,
} as const;

export const STORAGE_KEYS = {
  language: 'dailyhire:language',
  pendingRole: 'dailyhire:pendingRole',
  fcmRegistrationState: 'dailyhire:fcmRegistrationState',
} as const;

export const ENDPOINTS = {
  requestEmailOtp: 'requestEmailOtp',
  verifyEmailOtp: 'verifyEmailOtp',
  searchJobs: 'searchJobs',
  saveFcmToken: 'saveFcmToken',
  adminOverview: 'adminOverview',
  adminUsers: 'adminUsers',
  adminJobs: 'adminJobs',
  adminReports: 'adminReports',
  adminBlockUser: 'adminBlockUser',
  adminRemoveJob: 'adminRemoveJob',
} as const;

export const NOTIFICATION_TYPES: NotificationType[] = [
  'new_job',
  'application_received',
  'application_accepted',
  'application_rejected',
  'job_closed',
  'account',
];

export const DATE_INPUT_FORMAT = 'YYYY-MM-DD';
