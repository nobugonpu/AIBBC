import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useIdleLock } from '../hooks/useIdleLock';

const DEFAULT_IDLE_MS = 15 * 60 * 1000; // 15 minutes

interface AuthContextValue {
  unlocked: boolean;
  unlock: () => void;   // called by LocalAuth after successful invoke('unlock')
  lock: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function IdleLockWatcher({ onLock }: { onLock: () => void }) {
  useIdleLock(DEFAULT_IDLE_MS, onLock);
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);

  // Re-hydrate state in case the component remounts while the Rust session is
  // still open (e.g. React StrictMode double-mount in development).
  useEffect(() => {
    invoke<boolean>('is_unlocked')
      .then(setUnlocked)
      .catch(() => setUnlocked(false));
  }, []);

  const unlock = useCallback(() => setUnlocked(true), []);

  const lock = useCallback(async () => {
    try {
      await invoke('lock');
    } finally {
      setUnlocked(false);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ unlocked, unlock, lock }}>
      {/* Only watch for idle when the session is actually open */}
      {unlocked && <IdleLockWatcher onLock={lock} />}
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
