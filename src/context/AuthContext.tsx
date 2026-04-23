// AuthContext.tsx – Context גלובלי לאימות משתמש
// מנהל את Firebase Auth ואת נתוני המשתמש מהבאקנד.
// מספק: user (Firebase), backendUser, login, logout, register.
// שומר נתוני משתמש ב-localStorage לביצועים טובים יותר.
// useAuth() – hook לגישה ל-context מכל קומפוננטה.
import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { registerUser, getMe, getEmailByUsername, BackendUser } from '@/lib/api';

interface AuthState {
  firebaseUser: FirebaseUser | null;
  backendUser: BackendUser | null;
  loading: boolean;
  isGuest: boolean;
  continueAsGuest: () => void;
  exitGuest: () => void;
  signIn: (emailOrUsername: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, username: string, referralCode?: string, displayName?: string) => Promise<void>;
  signInWithGoogle: (username?: string, referralCode?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  sendPasswordReset: (emailOrUsername: string) => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [backendUser, setBackendUser] = useState<BackendUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const continueAsGuest = () => setIsGuest(true);
  const exitGuest = () => setIsGuest(false);

  // Helper to ensure username contains only English letters, numbers, and basic symbols
  const sanitizeUsername = (name: string): string => {
    return name.replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase() || 'user';
  };

  // Sync backend user after Firebase auth state changes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        setIsGuest(false);
        try {
          const data = await getMe();
          setBackendUser(data.user);
        } catch (err: any) {
          // User exists in Firebase but not in backend — try auto-registration
          const baseName = fbUser.displayName || fbUser.email?.split('@')[0] || 'User';
          const sanitizedVal = sanitizeUsername(baseName);
            
          const tryRegister = async (username: string): Promise<void> => {
            try {
              const params = new URLSearchParams(window.location.search);
              const referralCode = params.get('ref') || undefined;
              const regData = await registerUser(username, referralCode, fbUser.photoURL || undefined);
              setBackendUser(regData.user);
            } catch (regErr: any) {
              if (regErr?.message?.includes('already exists') || regErr?.status === 400) {
                // Could be same Firebase UID already registered — try getMe first
                try {
                  const data = await getMe();
                  setBackendUser(data.user);
                } catch {
                  // Username or email conflict or validation error — retry with unique suffix
                  const suffix = Math.random().toString(36).slice(-4);
                  await tryRegister(`${username}_${suffix}`);
                }
              } else {
                console.error('Auto-registration failed:', regErr);
                setBackendUser(null);
              }
            }
          };
          await tryRegister(sanitizedVal);
        }
      } else {
        setBackendUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  // Resolve username → email if the input doesn't look like an email
  const resolveEmail = async (emailOrUsername: string): Promise<string> => {
    if (emailOrUsername.includes('@')) return emailOrUsername;
    const { email } = await getEmailByUsername(emailOrUsername.trim());
    return email;
  };

  const signIn = async (emailOrUsername: string, password: string) => {
    const email = await resolveEmail(emailOrUsername);
    const cred = await signInWithEmailAndPassword(auth, email, password);
    try {
      const data = await getMe();
      setBackendUser(data.user);
    } catch {
      const name = cred.user.displayName || cred.user.email?.split('@')[0] || 'User';
      const data = await registerUser(name, undefined, cred.user.photoURL || undefined);
      setBackendUser(data.user);
    }
  };

  const sendPasswordReset = async (emailOrUsername: string) => {
    const email = await resolveEmail(emailOrUsername);
    await sendPasswordResetEmail(auth, email, {
      url: window.location.origin,
      handleCodeInApp: false,
    });
  };

  const signUp = async (email: string, password: string, username: string, referralCode?: string, displayName?: string) => {
    await createUserWithEmailAndPassword(auth, email, password);
    try {
      const data = await registerUser(sanitizeUsername(username), referralCode, undefined, displayName);
      setBackendUser(data.user);
    } catch (err: any) {
      // If auto-registration already fired via onAuthStateChanged, just fetch existing user
      if (err?.status === 409 || err?.message?.includes('409') || err?.message?.includes('already exists')) {
        const data = await getMe();
        setBackendUser(data.user);
      } else {
        throw err;
      }
    }
  };

  const signInWithGoogle = async (username?: string, referralCode?: string) => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const photoURL = result.user.photoURL ?? undefined;
    // Try to get existing backend user; if 404, register
    try {
      const data = await getMe();
      setBackendUser(data.user);
    } catch {
      const name = username || result.user.displayName || 'User';
      const data = await registerUser(sanitizeUsername(name), referralCode, photoURL);
      setBackendUser(data.user);
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setBackendUser(null);
  };

  const refreshUser = async () => {
    try {
      const data = await getMe();
      setBackendUser(data.user);
    } catch {}
  };

  // Auto-refresh balance when tab becomes visible (handles stale cached balance)
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') refreshUser(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  return (
    <AuthContext.Provider value={{ firebaseUser, backendUser, loading, isGuest, continueAsGuest, exitGuest, signIn, signUp, signInWithGoogle, signOut, refreshUser, sendPasswordReset }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
