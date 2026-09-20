import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore as getFirebaseFirestore,
  limit,
  orderBy,
  query,
  runTransaction,
  startAfter,
  updateDoc,
  where,
  type DocumentData,
  type QueryConstraint,
  type QuerySnapshot,
  type QueryDocumentSnapshot,
} from '@react-native-firebase/firestore';
import {COLLECTIONS, LIMITS} from '../../constants';
import {Application, ApplicationStatus, JobStatus, UserSummary} from '../../types';
import {AppError} from '../../utils/errors';
import {getAuth} from '../firebase';

export type ApplicationCursor = QueryDocumentSnapshot;

function readString(data: DocumentData, field: string): string {
  return typeof data[field] === 'string' ? data[field] : '';
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

function readStatus(value: unknown): ApplicationStatus {
  return ['pending', 'accepted', 'rejected', 'cancelled'].includes(value as ApplicationStatus)
    ? (value as ApplicationStatus)
    : 'pending';
}

function readRole(value: unknown): UserSummary['role'] {
  return value === 'employer' || value === 'worker' || value === 'admin'
    ? value
    : 'worker';
}

function applicationFromDocument(id: string, data: DocumentData): Application {
  return {
    applicationId: readString(data, 'applicationId') || id,
    jobId: readString(data, 'jobId'),
    workerId: readString(data, 'workerId'),
    employerId: readString(data, 'employerId'),
    status: readStatus(data.status),
    appliedAt: readDate(data.appliedAt).toISOString(),
    updatedAt: readDate(data.updatedAt).toISOString(),
  };
}

async function readWorker(workerId: string): Promise<UserSummary | undefined> {
  const snapshot = await getDoc(doc(getFirebaseFirestore(), COLLECTIONS.users, workerId));
  if (!snapshot.exists()) return undefined;
  const data = snapshot.data() ?? {};
  return {
    uid: workerId,
    role: readRole(data.role),
    name: typeof data.name === 'string' && data.name ? data.name : workerId,
    ...(typeof data.profilePhoto === 'string' && data.profilePhoto
      ? {profilePhoto: data.profilePhoto}
      : {}),
    ...(typeof data.location === 'string' && data.location ? {location: data.location} : {}),
    isBlocked: data.isBlocked === true,
  };
}

async function readJobSummary(jobId: string): Promise<Application['job'] | undefined> {
  const snapshot = await getDoc(doc(getFirebaseFirestore(), COLLECTIONS.jobs, jobId));
  if (!snapshot.exists()) return undefined;
  const data = snapshot.data() ?? {};
  const salary = typeof data.salary === 'number' ? data.salary : 0;
  const status = data.status === 'closed' || data.status === 'filled' ? data.status : 'open';
  return {
    jobId,
    title: typeof data.title === 'string' ? data.title : jobId,
    location: typeof data.location === 'string' ? data.location : '',
    salary,
    salaryUnit: data.salaryUnit === 'hourly' || data.salaryUnit === 'fixed'
      ? data.salaryUnit
      : 'daily',
    status: status as JobStatus,
  };
}

export async function enrichApplication(application: Application): Promise<Application> {
  const [worker, job] = await Promise.all([readWorker(application.workerId), readJobSummary(application.jobId)]);
  const result: Application = {...application};
  if (worker) result.worker = worker;
  if (job) result.job = job;
  return result;
}

export async function applyToJob(jobId: string): Promise<Application> {
  const user = getAuth().currentUser;
  if (!user) throw new AppError('unauthorized', 'unauthorized', false);
  const workerSnapshot = await getDoc(doc(getFirebaseFirestore(), COLLECTIONS.users, user.uid));
  const worker = workerSnapshot.data() ?? {};
  if (worker.role !== 'worker' || worker.isBlocked === true) {
    throw new AppError('unauthorized', 'unauthorized', false);
  }
  const jobReference = doc(getFirebaseFirestore(), COLLECTIONS.jobs, jobId);
  const applicationId = `${jobId}:${user.uid}`;
  const applicationReference = doc(getFirebaseFirestore(), COLLECTIONS.applications, applicationId);
  let employerId = '';
  try {
    await runTransaction(getFirebaseFirestore(), async transaction => {
      const job = await transaction.get(jobReference);
      if (!job.exists()) throw new AppError('not_found', 'not_found', false);
      const jobData = job.data() ?? {};
      if (jobData.status !== 'open') throw new AppError('job_not_open', 'job_not_open', false);
      const existing = await transaction.get(applicationReference);
      if (existing.exists()) throw new AppError('duplicate_application', 'duplicate_application', false);
      const candidateEmployerId = typeof jobData.employerId === 'string' ? jobData.employerId : '';
      if (!candidateEmployerId) throw new AppError('invalid_job', 'invalid_job', false);
      employerId = candidateEmployerId;
      transaction.set(applicationReference, {
        applicationId,
        jobId,
        workerId: user.uid,
        employerId,
        status: 'pending',
        appliedAt: new Date(),
        updatedAt: new Date(),
      });
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('application_failed', 'application_failed', true);
  }
  const application: Application = {
    applicationId,
    jobId,
    workerId: user.uid,
    employerId,
    status: 'pending',
    appliedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return enrichApplication(application);
}

export async function listWorkerApplications(
  workerId: string,
  cursor?: ApplicationCursor,
): Promise<{items: Application[]; nextCursor?: ApplicationCursor; hasMore: boolean}> {
  const constraints: QueryConstraint[] = [
    where('workerId', '==', workerId),
    orderBy('appliedAt', 'desc'),
    ...(cursor ? [startAfter(cursor)] : []),
    limit(LIMITS.notificationPageSize),
  ];
  const snapshot = await getDocs(
    query(collection(getFirebaseFirestore(), COLLECTIONS.applications), ...constraints),
  );
  const items = await Promise.all(
    snapshot.docs.map(document =>
      enrichApplication(applicationFromDocument(document.id, document.data())),
    ),
  );
  return {
    items,
    ...(snapshot.docs.length > 0 ? {nextCursor: snapshot.docs[snapshot.docs.length - 1]} : {}),
    hasMore: snapshot.docs.length >= LIMITS.notificationPageSize,
  };
}

export async function listJobApplicants(
  jobId: string,
  cursor?: ApplicationCursor,
): Promise<{items: Application[]; nextCursor?: ApplicationCursor; hasMore: boolean}> {
  const constraints: QueryConstraint[] = [
    where('jobId', '==', jobId),
    orderBy('appliedAt', 'desc'),
    ...(cursor ? [startAfter(cursor)] : []),
    limit(LIMITS.applicantPageSize),
  ];
  const snapshot = await getDocs(
    query(collection(getFirebaseFirestore(), COLLECTIONS.applications), ...constraints),
  );
  const items = await Promise.all(
    snapshot.docs.map(document =>
      enrichApplication(applicationFromDocument(document.id, document.data())),
    ),
  );
  return {
    items,
    ...(snapshot.docs.length > 0 ? {nextCursor: snapshot.docs[snapshot.docs.length - 1]} : {}),
    hasMore: snapshot.docs.length >= LIMITS.applicantPageSize,
  };
}

export async function getApplication(applicationId: string): Promise<Application | null> {
  const snapshot = await getDoc(
    doc(getFirebaseFirestore(), COLLECTIONS.applications, applicationId),
  );
  return snapshot.exists()
    ? enrichApplication(applicationFromDocument(snapshot.id, snapshot.data() ?? {}))
    : null;
}

export async function updateApplicationStatus(
  applicationId: string,
  status: Exclude<ApplicationStatus, 'cancelled'>,
): Promise<Application> {
  const user = getAuth().currentUser;
  if (!user) throw new AppError('unauthorized', 'unauthorized', false);
  const reference = doc(getFirebaseFirestore(), COLLECTIONS.applications, applicationId);
  const snapshot = await getDoc(reference);
  if (!snapshot.exists()) throw new AppError('not_found', 'not_found', false);
  const data = snapshot.data() ?? {};
  if (readString(data, 'employerId') !== user.uid) {
    throw new AppError('unauthorized', 'unauthorized', false);
  }
  await updateDoc(reference, {status, updatedAt: new Date()});
  return enrichApplication(applicationFromDocument(snapshot.id, {...data, status, updatedAt: new Date()}));
}

export async function cancelApplication(applicationId: string): Promise<void> {
  const user = getAuth().currentUser;
  if (!user) throw new AppError('unauthorized', 'unauthorized', false);
  const reference = doc(getFirebaseFirestore(), COLLECTIONS.applications, applicationId);
  const snapshot = await getDoc(reference);
  if (!snapshot.exists()) throw new AppError('not_found', 'not_found', false);
  if (readString(snapshot.data() ?? {}, 'workerId') !== user.uid) {
    throw new AppError('unauthorized', 'unauthorized', false);
  }
  await updateDoc(reference, {status: 'cancelled', updatedAt: new Date()});
}
