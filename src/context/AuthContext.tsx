import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { registerUser, getMe, BackendUser } from '@/lib/api';

interface AuthState {
  firebaseUser: FirebaseUser | null;
  backendUser: BackendUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, username: string, referralCode?: string, displayName?: string) => Promise<void>;
  signInWithGoogle: (username?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [backendUser, setBackendUser] = useState<BackendUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Sync backend user after Firebase auth state changes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        try {
          const data = await getMe();
          setBackendUser(data.user);
        } catch (err: any) {
          // User exists in Firebase but not in backend — try auto-registration
          const baseName = fbUser.displayName || fbUser.email?.split('@')[0] || 'User';
          const tryRegister = async (username: string): Promise<void> => {
            try {
              const regData = await registerUser(username, undefined, fbUser.photoURL || undefined);
              setBackendUser(regData.user);
            } catch (regErr: any) {
              if (regErr?.message?.includes('already exists')) {
                // Could be same Firebase UID already registered — try getMe first
                try {
                  const data = await getMe();
                  setBackendUser(data.user);
                } catch {
                  // Username or email conflict with a different account — retry with unique suffix
                  if (username === baseName) {
                    const suffix = Math.random().toString(36).slice(-4);
                    await tryRegister(`${baseName.replace(/\s+/g, '')}_${suffix}`);
                  } else {
                    console.error('Auto-registration failed after retry:', regErr);
                    setBackendUser(null);
                  }
                }
              } else {
                console.error('Auto-registration failed:', regErr);
                setBackendUser(null);
              }
            }
          };
          await tryRegister(baseName);
        }
      } else {
        setBackendUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const signIn = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    try {
      const data = await getMe();
      setBackendUser(data.user);
    } catch {
      // Backend user missing (e.g. account was deleted) — re-register with 5000 pts
      const name = cred.user.displayName || cred.user.email?.split('@')[0] || 'User';
      const data = await registerUser(name, undefined, cred.user.photoURL || undefined);
      setBackendUser(data.user);
    }
  };

  const signUp = async (email: string, password: string, username: string, referralCode?: string, displayName?: string) => {
    await createUserWithEmailAndPassword(auth, email, password);
    try {
      const data = await registerUser(username, referralCode, undefined, displayName);
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

  const signInWithGoogle = async (username?: string) => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const photoURL = result.user.photoURL ?? undefined;
    // Try to get existing backend user; if 404, register
    try {
      const data = await getMe();
      setBackendUser(data.user);
    } catch {
      const name = username || result.user.displayName || 'User';
      const data = await registerUser(name, undefined, photoURL);
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

  return (
    <AuthContext.Provider value={{ firebaseUser, backendUser, loading, signIn, signUp, signInWithGoogle, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
