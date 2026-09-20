import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {
  restoreSession,
  requestEmailOtp as requestEmailOtpService,
  signOutCurrentUser,
  subscribeToAuthState,
  verifyEmailOtp as verifyEmailOtpService,
  type AuthContextValue,
  type AuthSession,
  type EmailOtpRequestResult,
} from '../services/auth';

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({children}: {children: React.ReactNode}) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let mounted = true;
    const unsubscribe = subscribeToAuthState(async firebaseUser => {
      if (!mounted) return;
      if (!firebaseUser) {
        setSession(null);
        return;
      }
      try {
        setSession(await restoreSession());
      } catch {
        setSession(null);
      } finally {
        if (mounted) {
          setLoading(false);
          setInitialized(true);
        }
      }
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const requestOtp = useCallback<AuthContextValue['requestOtp']>(
    (email, role, language) => requestEmailOtpService(email, role, language),
    [],
  );

  const verifyOtp = useCallback<AuthContextValue['verifyOtp']>(
    async (email, otp, role, language) => {
      const nextSession = await verifyEmailOtpService(email, otp, role, language);
      setSession(nextSession);
      setLoading(false);
      setInitialized(true);
      return nextSession;
    },
    [],
  );

  const signOut = useCallback<AuthContextValue['signOut']>(async () => {
    await signOutCurrentUser();
    setSession(null);
  }, []);

  const refreshSession = useCallback<AuthContextValue['refreshSession']>(
    async () => {
      const nextSession = await restoreSession();
      setSession(nextSession);
      return nextSession;
    },
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      initialized,
      requestOtp,
      verifyOtp,
      restoreSession: refreshSession,
      signOut,
      refreshSession,
    }),
    [session, loading, initialized, requestOtp, verifyOtp, refreshSession, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export type {AuthContextValue, AuthSession, EmailOtpRequestResult};
