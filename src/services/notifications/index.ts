import {Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection,
  doc,
  getDocs,
  getFirestore as getFirebaseFirestore,
  limit,
  orderBy,
  query,
  startAfter,
  updateDoc,
  where,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from '@react-native-firebase/firestore';
import {
  getMessaging,
  getToken,
  hasPermission,
  registerDeviceForRemoteMessages,
  requestPermission,
} from '@react-native-firebase/messaging';
import {COLLECTIONS, ENDPOINTS, LIMITS, STORAGE_KEYS} from '../../constants';
import type {Notification} from '../../types';
import {callBackend} from '../../utils/api';
import {toError} from '../../utils/errors';

export type NotificationCursor = QueryDocumentSnapshot;

export interface NotificationPage {
  items: Notification[];
  nextCursor?: NotificationCursor;
  hasMore: boolean;
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

function notificationFromDocument(id: string, data: DocumentData): Notification {
  const result: Notification = {
    notificationId: typeof data.notificationId === 'string' ? data.notificationId : id,
    recipientUid: typeof data.recipientUid === 'string' ? data.recipientUid : '',
    type: typeof data.type === 'string'
      ? data.type as Notification['type']
      : 'account',
    title: typeof data.title === 'string' ? data.title : '',
    body: typeof data.body === 'string' ? data.body : '',
    read: data.read === true,
    createdAt: readDate(data.createdAt).toISOString(),
  };
  const actionType = data.actionType;
  if (typeof actionType === 'string' && actionType.length > 0) {
    result.actionType = actionType as NonNullable<Notification['actionType']>;
  }
  if (typeof data.actionId === 'string') result.actionId = data.actionId;
  return result;
}

export async function registerForPushNotifications(
  uid: string,
  idToken: string,
): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  const messaging = getMessaging();
  const permission = await hasPermission(messaging);
  if (permission < 1) {
    await requestPermission(messaging);
  }
  await registerDeviceForRemoteMessages(messaging);
  const token = await getToken(messaging);
  if (!token) return null;
  await callBackend<{saved: boolean}>(ENDPOINTS.saveFcmToken, {
    method: 'POST',
    token: idToken,
    body: {token},
  });
  await AsyncStorage.setItem(STORAGE_KEYS.fcmRegistrationState, token);
  return token;
}

export async function listNotifications(
  recipientUid: string,
  cursor?: NotificationCursor,
): Promise<NotificationPage> {
  const constraints: QueryConstraint[] = [
    where('recipientUid', '==', recipientUid),
    orderBy('createdAt', 'desc'),
    ...(cursor ? [startAfter(cursor)] : []),
    limit(LIMITS.notificationPageSize),
  ];
  const snapshot = await getDocs(
    query(collection(getFirebaseFirestore(), COLLECTIONS.notifications), ...constraints),
  );
  return {
    items: snapshot.docs.map(document =>
      notificationFromDocument(document.id, document.data()),
    ),
    ...(snapshot.docs.length > 0 ? {nextCursor: snapshot.docs[snapshot.docs.length - 1]} : {}),
    hasMore: snapshot.docs.length >= LIMITS.notificationPageSize,
  };
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await updateDoc(
    doc(getFirebaseFirestore(), COLLECTIONS.notifications, notificationId),
    {read: true},
  );
}

export async function markAllNotificationsRead(recipientUid: string): Promise<void> {
  const snapshot = await getDocs(
    query(
      collection(getFirebaseFirestore(), COLLECTIONS.notifications),
      where('recipientUid', '==', recipientUid),
      where('read', '==', false),
    ),
  );
  await Promise.all(
    snapshot.docs.map(document => updateDoc(document.ref, {read: true})),
  );
}

export function getNotificationError(error: unknown): Error {
  return toError(error);
}
