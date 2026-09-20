import React, {useCallback, useEffect, useState} from 'react';

export interface RemoteState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  reload: () => Promise<void>;
}

export function useRemoteData<T>(loader: () => Promise<T>, dependencies: unknown[] = []): RemoteState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await loader());
    } catch (caught) {
      setError(caught instanceof Error ? caught : new Error(String(caught)));
    } finally {
      setLoading(false);
    }
  }, dependencies);
  React.useEffect(() => {
    void reload();
  }, [reload]);
  return {data, loading, error, reload};
}
