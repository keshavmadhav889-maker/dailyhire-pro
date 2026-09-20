export class AppError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly details: Record<string, unknown> | undefined;

  constructor(
    message: string,
    code = 'unknown_error',
    retryable = true,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.retryable = retryable;
    this.details = details;
  }
}

export function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(typeof error === 'string' ? error : 'An unexpected error occurred');
}

export function getErrorCode(error: unknown): string {
  const candidate = error as {code?: unknown} | undefined;
  return typeof candidate?.code === 'string' ? candidate.code : 'unknown_error';
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
