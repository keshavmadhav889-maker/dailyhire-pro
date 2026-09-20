import {getApp} from '@react-native-firebase/app';
import {getAuth as getFirebaseAuth, type Auth} from '@react-native-firebase/auth';
import {getFirestore as getFirebaseFirestore, type Firestore} from '@react-native-firebase/firestore';
import {getMessaging as getFirebaseMessaging, type Messaging} from '@react-native-firebase/messaging';
import {getStorage as getFirebaseStorage, type FirebaseStorage as RNFBFirebaseStorage} from '@react-native-firebase/storage';

export function getFirebaseApp() {
  return getApp();
}

export function getAuth(): Auth {
  return getFirebaseAuth();
}

export function getFirestore(): Firestore {
  return getFirebaseFirestore();
}

export function getMessaging(): Messaging {
  return getFirebaseMessaging();
}

export function getStorage(): RNFBFirebaseStorage {
  return getFirebaseStorage();
}

export type FirebaseApp = ReturnType<typeof getFirebaseApp>;
export type FirebaseAuth = Auth;
export type FirebaseFirestore = Firestore;
export type FirebaseMessaging = Messaging;
export type FirebaseStorage = RNFBFirebaseStorage;
