import {Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import {STORAGE_KEYS} from '../constants';
import {Language, UserRole} from '../types';

export async function getStoredLanguage(): Promise<Language> {
  const value = await AsyncStorage.getItem(STORAGE_KEYS.language);
  return value === 'hi' ? 'hi' : 'en';
}

export async function storeLanguage(language: Language): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.language, language);
}

export async function getPendingRole(): Promise<UserRole | undefined> {
  const value = await SecureStore.getItemAsync(STORAGE_KEYS.pendingRole);
  return value === 'employer' || value === 'worker' ? value : undefined;
}

export async function storePendingRole(role: UserRole): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEYS.pendingRole, role);
}

export async function clearPendingRole(): Promise<void> {
  await SecureStore.deleteItemAsync(STORAGE_KEYS.pendingRole);
}

export function isSecureStorageAvailable(): boolean {
  return Platform.OS !== 'web';
}
