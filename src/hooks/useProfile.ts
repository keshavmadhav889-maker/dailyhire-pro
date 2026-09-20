import {useCallback, useEffect, useState} from 'react';
import {doc, getDoc, getFirestore as getFirebaseFirestore, updateDoc} from '@react-native-firebase/firestore';
import {COLLECTIONS} from '../constants';
import {ProfileFormValues, UserProfile} from '../types';
import {updateProfile as updateProfileService} from '../services/auth';
import {PickedPhoto, uploadProfilePhoto} from '../services/storage';

export interface UseProfileResult {
  profile: UserProfile | null;
  loading: boolean;
  error: Error | null;
  save: (values: ProfileFormValues) => Promise<void>;
  uploadPhoto: (photo: PickedPhoto) => Promise<string>;
  reload: () => Promise<void>;
}

export function useProfile(uid: string | undefined): UseProfileResult {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(async () => {
    if (!uid) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const snapshot = await getDoc(doc(getFirebaseFirestore(), COLLECTIONS.users, uid));
      if (snapshot.exists()) {
        const data = snapshot.data() ?? {};
        setProfile({
          uid,
          role: data.role === 'employer' ? 'employer' : data.role === 'admin' ? 'admin' : 'worker',
          email: typeof data.email === 'string' ? data.email : '',
          name: typeof data.name === 'string' ? data.name : '',
          skills: Array.isArray(data.skills) ? data.skills.filter((value): value is string => typeof value === 'string') : [],
          preferredCategories: Array.isArray(data.preferredCategories)
            ? data.preferredCategories.filter((value): value is UserProfile['preferredCategories'][number] => typeof value === 'string')
            : [],
          createdAt: typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString(),
          updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString(),
          isBlocked: data.isBlocked === true,
          ...(typeof data.phone === 'string' ? {phone: data.phone} : {}),
          ...(typeof data.profilePhoto === 'string' ? {profilePhoto: data.profilePhoto} : {}),
          ...(typeof data.age === 'number' ? {age: data.age} : {}),
          ...(typeof data.gender === 'string' ? {gender: data.gender as UserProfile['gender']} : {}),
          ...(typeof data.address === 'string' ? {address: data.address} : {}),
          ...(typeof data.location === 'string' ? {location: data.location} : {}),
          ...(typeof data.experience === 'number' ? {experience: data.experience} : {}),
          ...(typeof data.businessName === 'string' ? {businessName: data.businessName} : {}),
        } as UserProfile);
      } else {
        setProfile(null);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught : new Error(String(caught)));
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = useCallback(
    async (values: ProfileFormValues) => {
      if (!uid) throw new Error('User is not signed in');
      await updateProfileService(uid, values);
      await reload();
    },
    [reload, uid],
  );

  const uploadPhoto = useCallback(
    async (photo: PickedPhoto) => {
      if (!uid) throw new Error('User is not signed in');
      const url = await uploadProfilePhoto(uid, photo);
      await updateDoc(doc(getFirebaseFirestore(), COLLECTIONS.users, uid), {
        profilePhoto: url,
        updatedAt: new Date(),
      });
      await reload();
      return url;
    },
    [reload, uid],
  );

  return {profile, loading, error, save, uploadPhoto, reload};
}
