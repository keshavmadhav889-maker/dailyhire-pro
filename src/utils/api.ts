import {AppError} from './errors';
import {BackendErrorPayload, JobFormValues, ProfileFormValues} from '../types';
import {getFunctionsUrl} from './environment';

const DEFAULT_TIMEOUT_MS = 15000;

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string;
  signal?: AbortSignal;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') ?? '';
  const payload = (contentType.includes('json')
    ? await response.json()
    : await response.text()) as T | string;
  if (!response.ok) {
    const backend = (typeof payload === 'object' && payload !== null
      ? payload
      : {message: payload}) as BackendErrorPayload;
    throw new AppError(
      backend.message || 'The service is temporarily unavailable',
      backend.code || 'backend_error',
      response.status >= 500,
      backend.details,
    );
  }
  return payload as T;
}

export async function callBackend<T>(
  endpoint: string,
  options: ApiOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  const controller = options.signal ? undefined : new AbortController();
  const timeout = globalThis.setTimeout(
    () => controller?.abort(),
    DEFAULT_TIMEOUT_MS,
  );
  try {
  const init: RequestInit = {
    method: options.method ?? 'POST',
    headers,
  };
  if (options.signal) init.signal = options.signal;
  else if (controller) init.signal = controller.signal;
  if (options.body !== undefined) init.body = JSON.stringify(options.body);
  const response = await fetch(`${getFunctionsUrl()}/${endpoint.replace(/^\//, '')}`, init);
    return await parseResponse<T>(response);
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export function assertString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AppError(`${field} is required`, 'validation_error', false);
  }
  return value.trim();
}

export function assertNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new AppError(`${field} must be a number`, 'validation_error', false);
  }
  return value;
}

export function validateJobForm(values: JobFormValues): Record<string, string> | undefined {
  const errors: Record<string, string> = {};
  if (values.title.trim().length < 3) errors.title = 'title_required';
  if (!values.description.trim()) errors.description = 'description_required';
  if (!values.location.trim()) errors.location = 'location_required';
  const salary = Number(values.salary);
  if (!Number.isFinite(salary) || salary <= 0) errors.salary = 'salary_required';
  const workersNeeded = Number(values.workersNeeded);
  if (!Number.isInteger(workersNeeded) || workersNeeded < 1) {
    errors.workersNeeded = 'workers_required';
  }
  if (!values.startDate) errors.startDate = 'start_date_required';
  if (!values.workingHours.trim()) errors.workingHours = 'hours_required';
  return Object.keys(errors).length > 0 ? errors : undefined;
}

export function validateProfileForm(values: ProfileFormValues): Record<string, string> | undefined {
  const errors: Record<string, string> = {};
  if (values.name.trim().length < 2) errors.name = 'name_required';
  if (!values.location.trim()) errors.location = 'location_required';
  if (values.age && (!Number.isInteger(Number(values.age)) || Number(values.age) < 15)) {
    errors.age = 'age_required';
  }
  return Object.keys(errors).length > 0 ? errors : undefined;
}
