import {useCallback, useEffect, useState} from 'react';
import {JobCursor, listJobs} from '../services/jobs';
import {JobFilters, JobPage} from '../types';

export interface UseJobsResult {
  items: JobPage['items'];
  filters: JobFilters;
  loading: boolean;
  loadingMore: boolean;
  refreshing: boolean;
  error: Error | null;
  hasMore: boolean;
  setFilters: (filters: JobFilters) => void;
  loadMore: () => Promise<void>;
  reload: () => Promise<void>;
  clearError: () => void;
}

export function useJobs(initialFilters: JobFilters = {}): UseJobsResult {
  const [filters, setFiltersState] = useState<JobFilters>(initialFilters);
  const [items, setItems] = useState<JobPage['items']>([]);
  const [cursor, setCursor] = useState<JobCursor | undefined>();
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(
    async (nextFilters: JobFilters, nextCursor?: JobCursor, append = false) => {
      if (append) setLoadingMore(true);
      else if (!nextCursor) setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        const page = await listJobs({filters: nextFilters, ...(nextCursor ? {cursor: nextCursor} : {})});
        setItems(current => (append ? [...current, ...page.items] : page.items));
        setCursor(page.nextCursor as JobCursor | undefined);
        setHasMore(page.hasMore);
      } catch (caught) {
        setError(caught instanceof Error ? caught : new Error(String(caught)));
        if (!append) setItems([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load(filters);
  }, [filters, load]);

  const setFilters = useCallback((next: JobFilters) => {
    setFiltersState(next);
    setItems([]);
    setCursor(undefined);
    setHasMore(true);
  }, []);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    await load(filters, cursor, true);
  }, [cursor, filters, hasMore, load, loadingMore]);

  const reload = useCallback(async () => {
    setItems([]);
    setCursor(undefined);
    setHasMore(true);
    await load(filters);
  }, [filters, load]);

  return {
    items,
    filters,
    loading,
    loadingMore,
    refreshing,
    error,
    hasMore,
    setFilters,
    loadMore,
    reload,
    clearError: () => setError(null),
  };
}
