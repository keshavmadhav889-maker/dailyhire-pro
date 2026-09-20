export function getPublicEnv(name: string): string | undefined {
  const runtime = globalThis as typeof globalThis & {
    process?: {env?: Record<string, string | undefined>};
  };
  return runtime.process?.env?.[name];
}

export function getFunctionsUrl(): string {
  const url = getPublicEnv('EXPO_PUBLIC_FUNCTIONS_URL');
  if (!url) {
    throw new Error('EXPO_PUBLIC_FUNCTIONS_URL is not configured');
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error('Invalid functions URL');
    }
    return url.replace(/\/+$/, '');
  } catch (error) {
    throw new Error('EXPO_PUBLIC_FUNCTIONS_URL must be a valid HTTP URL', {cause: error});
  }
}
