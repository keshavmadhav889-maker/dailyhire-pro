export type UserRole = 'worker' | 'employer' | 'admin';

export type JobCategory =
  | 'Construction'
  | 'Farming'
  | 'Delivery'
  | 'Helper'
  | 'Electrician'
  | 'Plumber'
  | 'Driver'
  | 'Loader'
  | 'Agriculture Labour'
  | 'Other';

export type JobStatus = 'draft' | 'open' | 'closed' | 'filled';
export type ApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';
export type NotificationType =
  | 'new_job'
  | 'application_received'
  | 'application_accepted'
  | 'application_rejected'
  | 'job_closed'
  | 'account';
export type Gender = 'female' | 'male' | 'other' | 'prefer_not_to_say';
export type Language = 'en' | 'hi';

export interface UserProfile {
  uid: string;
  role: UserRole;
  email: string;
  name: string;
  phone?: string;
  profilePhoto?: string;
  age?: number;
  gender?: Gender;
  address?: string;
  location?: string;
  skills: string[];
  experience?: number;
  preferredCategories: JobCategory[];
  createdAt: string;
  updatedAt: string;
  isBlocked: boolean;
  fcmTokens?: string[];
}

export interface EmployerProfile extends UserProfile {
  role: 'employer';
  businessName?: string;
}

export interface WorkerProfile extends UserProfile {
  role: 'worker';
}

export interface UserSummary {
  uid: string;
  role: UserRole;
  name: string;
  profilePhoto?: string;
  location?: string;
  isBlocked: boolean;
}

export interface Job {
  jobId: string;
  employerId: string;
  title: string;
  category: JobCategory;
  description: string;
  location: string;
  salary: number;
  salaryUnit: 'daily' | 'hourly' | 'fixed';
  workingHours: string;
  workersNeeded: number;
  workersApplied: number;
  startDate: string;
  contactNumber?: string;
  status: JobStatus;
  featured: boolean;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
  employer?: UserSummary;
}

export interface JobFilters {
  query?: string;
  category?: JobCategory | 'All';
  location?: string;
  minSalary?: number;
  maxSalary?: number;
  startDate?: string;
  status?: JobStatus;
  featuredOnly?: boolean;
}

export interface JobPage {
  items: Job[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface Application {
  applicationId: string;
  jobId: string;
  workerId: string;
  employerId: string;
  status: ApplicationStatus;
  appliedAt: string;
  updatedAt: string;
  worker?: UserSummary;
  job?: Pick<Job, 'jobId' | 'title' | 'location' | 'salary' | 'salaryUnit' | 'status'>;
}

export interface Notification {
  notificationId: string;
  recipientUid: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  actionType?: 'job' | 'application' | 'profile';
  actionId?: string;
}

export interface EmailOtpRequest {
  email: string;
  role: 'worker' | 'employer';
  language: Language;
}

export interface EmailOtpVerification {
  email: string;
  otp: string;
  role: 'worker' | 'employer';
}

export interface AuthenticatedUser {
  uid: string;
  email: string;
  role: UserRole;
  name?: string;
  profilePhoto?: string;
  isAdmin?: boolean;
}

export interface EmailOtpVerificationResponse {
  customToken: string;
  user: AuthenticatedUser;
}

export interface BackendErrorPayload {
  code?: string;
  message?: string;
  details?: Record<string, unknown>;
}

export interface RemoteData<T> {
  data?: T;
  error?: Error;
  loading: boolean;
  refreshing: boolean;
  retry: () => void;
}

export interface PaginationState {
  firstVisible?: unknown;
  lastVisible?: unknown;
  hasMore: boolean;
  loadingMore: boolean;
}

export interface JobFormValues {
  title: string;
  category: JobCategory;
  description: string;
  location: string;
  salary: string;
  salaryUnit: 'daily' | 'hourly' | 'fixed';
  workingHours: string;
  workersNeeded: string;
  startDate: string;
  contactNumber: string;
  featured: boolean;
}

export interface ProfileFormValues {
  name: string;
  phone: string;
  age: string;
  gender: Gender | '';
  address: string;
  location: string;
  skills: string;
  experience: string;
  preferredCategories: JobCategory[];
  businessName: string;
}

export interface ReportSummary {
  reportId: string;
  reportedBy: string;
  targetUid: string;
  reason: string;
  status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
  createdAt: string;
}

export interface AdminOverview {
  users: number;
  employers: number;
  workers: number;
  jobs: number;
  applications: number;
  openReports: number;
}
