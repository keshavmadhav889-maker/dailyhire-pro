export const COLLECTIONS = {
  users: 'users',
  jobs: 'jobs',
  applications: 'applications',
  notifications: 'notifications',
  reports: 'reports',
} as const;

export const SUBCOLLECTIONS = {
  fcmTokens: 'fcmTokens',
} as const;

export const INDEX_FIELDS = {
  jobsStatusCreatedAt: ['status', 'createdAt'],
  jobsCategoryCreatedAt: ['category', 'createdAt'],
  applicationsWorkerAppliedAt: ['workerId', 'appliedAt'],
  applicationsJobStatus: ['jobId', 'status'],
  notificationsRecipientCreatedAt: ['recipientUid', 'createdAt'],
} as const;
