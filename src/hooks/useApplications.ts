import {useCallback, useEffect, useState} from 'react';
import {Application} from '../types';
import {ApplicationCursor, listJobApplicants, listWorkerApplications} from '../services/applications';

export interface UseApplicationsResult {
  items: Application[];
  loading: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  reload: () => Promise<void>;
}

export function useApplications(
  mode: 'worker' | 'employer',
  ownerId: string,
  jobId?: string,
): UseApplicationsResult {
  const [items, setItems] = useState<UseApplicationsResult['items']>([]);
  const [cursor, setCursor] = useState<ApplicationCursor | undefined>();
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(
    async (nextCursor?: ApplicationCursor, append = false) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const page = mode === 'worker'
          ? await listWorkerApplications(ownerId, nextCursor)
          : jobId
            ? await listJobApplicants(jobId, nextCursor)
            : undefined;
        if (!page) throw new Error('Job is required for applicant lists');
        setItems(current => (append ? [...current, ...page.items] : page.items));
        setCursor(page.nextCursor);
        setHasMore(page.hasMore);
      } catch (caught) {
        setError(caught instanceof Error ? caught : new Error(String(caught)));
        if (!append) setItems([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [jobId, mode, ownerId],
  );

  useEffect(() => {
    setItems([]);
    setCursor(undefined);
    setHasMore(true);
    void load();
  }, [jobId, load, mode, ownerId]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    await load(cursor, true);
  }, [cursor, hasMore, load, loadingMore]);

  const reload = useCallback(async () => {
    setItems([]);
    setCursor(undefined);
    setHasMore(true);
    await load();
  }, [load]);

  return {items, loading, error, hasMore, loadMore, reload};
}
