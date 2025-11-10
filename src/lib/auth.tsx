"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, User } from "firebase/auth";
import { auth, googleProvider, isFirebaseConfigured, db } from "./firebase";
import { doc, serverTimestamp, setDoc, getDoc } from "firebase/firestore";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signInGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  configured: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      // Garantir perfil em users/{uid}
      if (u && db) {
        const ref = doc(db, "users", u.uid);
        void (async () => {
          try {
            const snap = await getDoc(ref);
            const existing = snap.exists() ? (snap.data() as any) : null;
            const photoURL = (existing && existing.photoURL) ? existing.photoURL : (u.photoURL || null);
            const displayName = (existing && existing.displayName) ? existing.displayName : (u.displayName || null);
            const payload: any = {
              uid: u.uid,
              email: u.email || null,
              displayName,
              photoURL,
              updatedAt: serverTimestamp(),
            };
            if (!snap.exists()) payload.createdAt = serverTimestamp();
            await setDoc(ref, payload, { merge: true });
          } catch (e) {
            // Silencia erros de perfil para não quebrar a sessão
          }
        })();
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  async function signInGoogle() {
    if (!isFirebaseConfigured || !auth) return;
    if (!googleProvider) return;
    await signInWithPopup(auth, googleProvider);
  }

  async function logout() {
    if (!isFirebaseConfigured || !auth) return;
    await signOut(auth);
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, signInGoogle, logout, configured: isFirebaseConfigured }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}