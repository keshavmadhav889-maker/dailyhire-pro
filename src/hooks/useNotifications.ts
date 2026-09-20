import {useCallback, useEffect, useState} from 'react';
import {
  listNotifications,
  markAllNotificationsRead as markAllNotificationsReadService,
  markNotificationRead as markNotificationReadService,
  NotificationCursor,
  registerForPushNotifications,
} from '../services/notifications';
import {Notification} from '../types';

export interface UseNotificationsResult {
  items: Notification[];
  loading: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  reload: () => Promise<void>;
  markRead: (notificationId: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  registerDevice: () => Promise<string | null>;
}

export function useNotifications(
  recipientUid: string,
  idToken: string,
): UseNotificationsResult {
  const [items, setItems] = useState<Notification[]>([]);
  const [cursor, setCursor] = useState<NotificationCursor | undefined>();
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(
    async (nextCursor?: NotificationCursor, append = false) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const page = await listNotifications(recipientUid, nextCursor);
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
    [recipientUid],
  );

  useEffect(() => {
    setItems([]);
    setCursor(undefined);
    setHasMore(true);
    void load();
  }, [load, recipientUid]);

  const markRead = useCallback(async (notificationId: string) => {
    await markNotificationReadService(notificationId);
    setItems(current => current.map(item =>
      item.notificationId === notificationId ? {...item, read: true} : item,
    ));
  }, []);

  const markAllRead = useCallback(async () => {
    await markAllNotificationsReadService(recipientUid);
    setItems(current => current.map(item => ({...item, read: true})));
  }, [recipientUid]);

  const registerDevice = useCallback(
    () => registerForPushNotifications(recipientUid, idToken),
    [idToken, recipientUid],
  );

  const reload = useCallback(async () => {
    setItems([]);
    setCursor(undefined);
    setHasMore(true);
    await load();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    await load(cursor, true);
  }, [cursor, hasMore, load, loadingMore]);

  return {
    items,
    loading,
    error,
    hasMore,
    loadMore,
    reload,
    markRead,
    markAllRead,
    registerDevice,
  };
}
