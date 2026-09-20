import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore as getFirebaseFirestore,
  limit,
  orderBy,
  query,
  setDoc,
  startAfter,
  updateDoc,
  where,
  type DocumentData,
  type QuerySnapshot,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from '@react-native-firebase/firestore';
import {COLLECTIONS, ENDPOINTS, LIMITS} from '../../constants';
import {Job, JobFilters, JobFormValues, JobPage, JobStatus, UserSummary} from '../../types';
import {callBackend} from '../../utils/api';
import {AppError} from '../../utils/errors';
import {getAuth} from '../firebase';

export type JobCursor = QueryDocumentSnapshot;

export interface JobListOptions {
  filters?: JobFilters;
  cursor?: JobCursor;
  pageSize?: number;
}

export interface JobRepository {
  listJobs(options?: JobListOptions): Promise<JobPage>;
  searchJobs(filters: JobFilters, cursor?: JobCursor): Promise<JobPage>;
  getJob(jobId: string): Promise<Job | null>;
  createJob(values: JobFormValues): Promise<Job>;
  updateJob(jobId: string, values: JobFormValues): Promise<Job>;
  closeJob(jobId: string): Promise<void>;
  deleteJob(jobId: string): Promise<void>;
  listEmployerJobs(employerId: string, cursor?: JobCursor): Promise<JobPage>;
  listFeaturedJobs(pageSize?: number): Promise<Job[]>;
  listLatestJobs(pageSize?: number): Promise<Job[]>;
}

function readString(data: DocumentData, field: string): string {
  return typeof data[field] === 'string' ? data[field] : '';
}

function readNumber(data: DocumentData, field: string): number {
  return typeof data[field] === 'number' && Number.isFinite(data[field]) ? data[field] : 0;
}

function readDate(value: unknown, fallback = new Date()): Date {
  if (value && typeof value === 'object' && 'toDate' in value) {
    const candidate = value as {toDate?: unknown};
    if (typeof candidate.toDate === 'function') return candidate.toDate() as Date;
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.valueOf()) ? fallback : parsed;
  }
  return fallback;
}

function readCategory(value: unknown): Job['category'] {
  const categories: Job['category'][] = [
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
  return categories.includes(value as Job['category']) ? (value as Job['category']) : 'Other';
}

function readStatus(value: unknown): JobStatus {
  return ['draft', 'open', 'closed', 'filled'].includes(value as JobStatus)
    ? (value as JobStatus)
    : 'draft';
}

function readSalaryUnit(value: unknown): Job['salaryUnit'] {
  return ['daily', 'hourly', 'fixed'].includes(value as Job['salaryUnit'])
    ? (value as Job['salaryUnit'])
    : 'daily';
}

export function jobFromDocument(
  id: string,
  data: DocumentData,
  employer?: UserSummary,
): Job {
  const result: Job = {
    jobId: readString(data, 'jobId') || id,
    employerId: readString(data, 'employerId'),
    title: readString(data, 'title'),
    category: readCategory(data.category),
    description: readString(data, 'description'),
    location: readString(data, 'location'),
    salary: readNumber(data, 'salary'),
    salaryUnit: readSalaryUnit(data.salaryUnit),
    workingHours: readString(data, 'workingHours'),
    workersNeeded: readNumber(data, 'workersNeeded'),
    workersApplied: readNumber(data, 'workersApplied'),
    startDate: readDate(data.startDate).toISOString().slice(0, 10),
    status: readStatus(data.status),
    featured: data.featured === true,
    createdAt: readDate(data.createdAt).toISOString(),
    updatedAt: readDate(data.updatedAt).toISOString(),
  };
  if (typeof data.contactNumber === 'string' && data.contactNumber) {
    result.contactNumber = data.contactNumber;
  }
  if (typeof data.imageUrl === 'string' && data.imageUrl) result.imageUrl = data.imageUrl;
  if (employer) result.employer = employer;
  return result;
}

async function readEmployer(employerId: string): Promise<UserSummary | undefined> {
  if (!employerId) return undefined;
  const snapshot = await getDoc(doc(getFirebaseFirestore(), COLLECTIONS.users, employerId));
  if (!snapshot.exists()) return undefined;
  const data = snapshot.data() ?? {};
  return {
    uid: employerId,
    role: 'employer',
    name: typeof data.name === 'string' && data.name ? data.name : employerId,
    ...(typeof data.profilePhoto === 'string' && data.profilePhoto
      ? {profilePhoto: data.profilePhoto}
      : {}),
    ...(typeof data.location === 'string' && data.location ? {location: data.location} : {}),
    isBlocked: data.isBlocked === true,
  };
}

async function pageFromSnapshot(
  snapshot: QuerySnapshot,
  pageSize: number,
): Promise<JobPage> {
  const documents = snapshot.docs;
  const employers = await Promise.all(
    documents.map(document => readEmployer(readString(document.data(), 'employerId'))),
  );
  return {
    items: documents.map((document, index) =>
      jobFromDocument(document.id, document.data(), employers[index]),
    ),
    ...(documents.length > 0 ? {nextCursor: documents[documents.length - 1]} : {}),
    hasMore: documents.length >= pageSize,
  };
}

function filtersToConstraints(filters: JobFilters): QueryConstraint[] {
  const constraints: QueryConstraint[] = [];
  if (filters.category && filters.category !== 'All') {
    constraints.push(where('category', '==', filters.category));
  }
  if (filters.location?.trim()) constraints.push(where('location', '==', filters.location.trim()));
  if (filters.minSalary !== undefined) constraints.push(where('salary', '>=', filters.minSalary));
  if (filters.maxSalary !== undefined) constraints.push(where('salary', '<=', filters.maxSalary));
  if (filters.startDate) constraints.push(where('startDate', '>=', filters.startDate));
  if (filters.status) constraints.push(where('status', '==', filters.status));
  if (filters.featuredOnly) constraints.push(where('featured', '==', true));
  return constraints;
}

async function getCurrentToken(): Promise<string | undefined> {
  return getAuth().currentUser?.getIdToken();
}

export const jobRepository: JobRepository = {
  async listJobs(options = {}) {
    const pageSize = options.pageSize ?? LIMITS.jobPageSize;
    const constraints: QueryConstraint[] = [
      where('status', '==', 'open'),
      orderBy('featured', 'desc'),
      orderBy('createdAt', 'desc'),
      ...filtersToConstraints(options.filters ?? {}),
      ...(options.cursor ? [startAfter(options.cursor)] : []),
      limit(pageSize),
    ];
    const snapshot = await getDocs(
      query(collection(getFirebaseFirestore(), COLLECTIONS.jobs), ...constraints),
    );
    return pageFromSnapshot(snapshot, pageSize);
  },

  async searchJobs(filters, cursor) {
    if (filters.query?.trim()) {
      const token = await getCurrentToken();
      return callBackend<JobPage>(ENDPOINTS.searchJobs, {
        method: 'POST',
        ...(token ? {token} : {}),
        body: {filters, ...(cursor ? {cursor: cursor.id} : {})},
      });
    }
    return this.listJobs({
      filters,
      ...(cursor ? {cursor} : {}),
      pageSize: LIMITS.jobPageSize,
    });
  },

  async getJob(jobId: string) {
    const snapshot = await getDoc(doc(getFirebaseFirestore(), COLLECTIONS.jobs, jobId));
    if (!snapshot.exists()) return null;
    const data = snapshot.data() ?? {};
    const employerId = readString(data, 'employerId');
    return jobFromDocument(snapshot.id, data, await readEmployer(employerId));
  },

  async createJob(values) {
    const user = getAuth().currentUser;
    if (!user) throw new AppError('unauthorized', 'unauthorized', false);
    const profile = await getDoc(doc(getFirebaseFirestore(), COLLECTIONS.users, user.uid));
    const profileData = profile.data() ?? {};
    if (profileData.role !== 'employer' || profileData.isBlocked === true) {
      throw new AppError('unauthorized', 'unauthorized', false);
    }
    const reference = doc(collection(getFirebaseFirestore(), COLLECTIONS.jobs));
    const jobData: Omit<Job, 'employer' | 'jobId' | 'createdAt' | 'updatedAt'> = {
      employerId: user.uid,
      title: values.title.trim(),
      category: values.category,
      description: values.description.trim(),
      location: values.location.trim(),
      salary: Number(values.salary),
      salaryUnit: values.salaryUnit,
      workingHours: values.workingHours.trim(),
      workersNeeded: Number(values.workersNeeded),
      workersApplied: 0,
      startDate: values.startDate,
      status: 'open',
      featured: false,
    };
    const documentData: Record<string, unknown> = {
      ...jobData,
      jobId: reference.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    if (values.contactNumber.trim()) documentData.contactNumber = values.contactNumber.trim();
    await setDoc(reference, documentData);
    const created = await this.getJob(reference.id);
    if (!created) throw new AppError('not_found', 'not_found', false);
    return created;
  },

  async updateJob(jobId: string, values) {
    const user = getAuth().currentUser;
    if (!user) throw new AppError('unauthorized', 'unauthorized', false);
    const reference = doc(getFirebaseFirestore(), COLLECTIONS.jobs, jobId);
    const snapshot = await getDoc(reference);
    if (!snapshot.exists()) throw new AppError('not_found', 'not_found', false);
    if (readString(snapshot.data() ?? {}, 'employerId') !== user.uid) {
      throw new AppError('job_ownership_error', 'job_ownership_error', false);
    }
    const data: Record<string, unknown> = {
      title: values.title.trim(),
      category: values.category,
      description: values.description.trim(),
      location: values.location.trim(),
      salary: Number(values.salary),
      salaryUnit: values.salaryUnit,
      workingHours: values.workingHours.trim(),
      workersNeeded: Number(values.workersNeeded),
      startDate: values.startDate,
      updatedAt: new Date(),
    };
    if (values.contactNumber.trim()) data.contactNumber = values.contactNumber.trim();
    else data.contactNumber = null;
    await updateDoc(reference, data);
    const updated = await this.getJob(jobId);
    if (!updated) throw new AppError('not_found', 'not_found', false);
    return updated;
  },

  async closeJob(jobId: string) {
    const user = getAuth().currentUser;
    if (!user) throw new AppError('unauthorized', 'unauthorized', false);
    const reference = doc(getFirebaseFirestore(), COLLECTIONS.jobs, jobId);
    const snapshot = await getDoc(reference);
    if (!snapshot.exists()) throw new AppError('not_found', 'not_found', false);
    if (readString(snapshot.data() ?? {}, 'employerId') !== user.uid) {
      throw new AppError('job_ownership_error', 'job_ownership_error', false);
    }
    await updateDoc(reference, {status: 'closed', updatedAt: new Date()});
  },

  async deleteJob(jobId: string) {
    const user = getAuth().currentUser;
    if (!user) throw new AppError('unauthorized', 'unauthorized', false);
    const reference = doc(getFirebaseFirestore(), COLLECTIONS.jobs, jobId);
    const snapshot = await getDoc(reference);
    if (!snapshot.exists()) return;
    if (readString(snapshot.data() ?? {}, 'employerId') !== user.uid) {
      throw new AppError('job_ownership_error', 'job_ownership_error', false);
    }
    await deleteDoc(reference);
  },

  async listEmployerJobs(employerId, cursor) {
    const constraints: QueryConstraint[] = [
      where('employerId', '==', employerId),
      orderBy('createdAt', 'desc'),
      ...(cursor ? [startAfter(cursor)] : []),
      limit(LIMITS.jobPageSize),
    ];
    const snapshot = await getDocs(
      query(collection(getFirebaseFirestore(), COLLECTIONS.jobs), ...constraints),
    );
    return pageFromSnapshot(snapshot, LIMITS.jobPageSize);
  },

  async listFeaturedJobs(pageSize = 8) {
    const snapshot = await getDocs(
      query(
        collection(getFirebaseFirestore(), COLLECTIONS.jobs),
        where('status', '==', 'open'),
        where('featured', '==', true),
        orderBy('createdAt', 'desc'),
        limit(pageSize),
      ),
    );
    return (await pageFromSnapshot(snapshot, pageSize)).items;
  },

  async listLatestJobs(pageSize = 8) {
    const snapshot = await getDocs(
      query(
        collection(getFirebaseFirestore(), COLLECTIONS.jobs),
        where('status', '==', 'open'),
        orderBy('createdAt', 'desc'),
        limit(pageSize),
      ),
    );
    return (await pageFromSnapshot(snapshot, pageSize)).items;
  },
};

export async function listJobs(options?: JobListOptions): Promise<JobPage> {
  return jobRepository.listJobs(options);
}

export async function searchJobs(filters: JobFilters, cursor?: JobCursor): Promise<JobPage> {
  return jobRepository.searchJobs(filters, cursor);
}

export async function getJob(jobId: string): Promise<Job | null> {
  return jobRepository.getJob(jobId);
}

export async function createJob(values: JobFormValues): Promise<Job> {
  return jobRepository.createJob(values);
}

export async function updateJob(jobId: string, values: JobFormValues): Promise<Job> {
  return jobRepository.updateJob(jobId, values);
}

export async function closeJob(jobId: string): Promise<void> {
  return jobRepository.closeJob(jobId);
}

export async function deleteJob(jobId: string): Promise<void> {
  return jobRepository.deleteJob(jobId);
}
