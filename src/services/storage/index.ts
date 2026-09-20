import {Platform} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  deleteObject,
  getDownloadURL,
  getStorage as getFirebaseStorage,
  putFile,
  ref,
  type UploadMetadata,
} from '@react-native-firebase/storage';
import {LIMITS} from '../../constants';
import {AppError} from '../../utils/errors';

export type PhotoSource = 'camera' | 'gallery';

export interface PickedPhoto {
  uri: string;
  width: number;
  height: number;
  mimeType: string;
  fileSize: number;
}

async function requestPermission(source: PhotoSource): Promise<boolean> {
  if (source === 'camera') {
    const response = await ImagePicker.requestCameraPermissionsAsync();
    return response.granted;
  }
  const response = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return response.granted;
}

async function getAssetSize(uri: string): Promise<number> {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    return blob.size;
  } catch {
    return 0;
  }
}

export async function pickPhoto(source: PhotoSource): Promise<PickedPhoto> {
  if (Platform.OS === 'web') {
    throw new AppError('image_picker_unavailable', 'image_picker_unavailable', false);
  }
  if (!(await requestPermission(source))) {
    throw new AppError('permission_denied', 'permission_denied', false);
  }
  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })
    : await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
  if (result.canceled || !result.assets.length) return Promise.reject(new AppError('photo_cancelled', 'photo_cancelled', false));
  const asset = result.assets[0];
  if (!asset || asset.type !== 'image') {
    throw new AppError('invalid_image', 'invalid_image', false);
  }
  const fileSize = asset.fileSize ?? await getAssetSize(asset.uri);
  if (fileSize > LIMITS.maxProfilePhotoBytes) {
    throw new AppError('photo_too_large', 'photo_too_large', false);
  }
  return {
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
    mimeType: asset.mimeType ?? 'image/jpeg',
    fileSize,
  };
}

export async function uploadProfilePhoto(
  uid: string,
  photo: PickedPhoto,
): Promise<string> {
  const extension = photo.mimeType === 'image/png' ? 'png' : 'jpg';
  const path = `users/${uid}/profile-${Date.now()}.${extension}`;
  const metadata: UploadMetadata = {contentType: photo.mimeType};
  const task = putFile(ref(getFirebaseStorage(), path), photo.uri, metadata);
  await task;
  return getDownloadURL(ref(getFirebaseStorage(), path));
}

export async function uploadJobImage(
  jobId: string,
  photo: PickedPhoto,
): Promise<string> {
  const extension = photo.mimeType === 'image/png' ? 'png' : 'jpg';
  const path = `jobs/${jobId}/cover-${Date.now()}.${extension}`;
  const metadata: UploadMetadata = {contentType: photo.mimeType};
  const task = putFile(ref(getFirebaseStorage(), path), photo.uri, metadata);
  await task;
  return getDownloadURL(ref(getFirebaseStorage(), path));
}

export async function deleteStorageFile(path: string): Promise<void> {
  if (!path) return;
  await deleteObject(ref(getFirebaseStorage(), path));
}

export function getStoragePathFromUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    const path = decodeURIComponent(parsed.pathname);
    const marker = '/o/';
    const index = path.indexOf(marker);
    return index >= 0 ? path.slice(index + marker.length) : undefined;
  } catch {
    return undefined;
  }
}
