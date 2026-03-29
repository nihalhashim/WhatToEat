import { useEffect, useState, useRef } from 'react';

/** Persists state in sessionStorage — survives tool switching but clears on tab close */
export function useSessionState<T>(key: string, initialValue: T): [T, (val: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(initialValue);
  const isLoaded = useRef(false);

  // Load from session once on mount
  useEffect(() => {
    try {
      const item = sessionStorage.getItem(key);
      if (item !== null) {
        setState(JSON.parse(item));
      }
    } catch {
      // Ignore
    } finally {
      // Delay setting isLoaded to true to ensure state update has propagated
      setTimeout(() => {
        isLoaded.current = true;
      }, 0);
    }
  }, [key]);

  // Save to session only after initial load is confirmed
  useEffect(() => {
    if (!isLoaded.current) return;
    try {
      sessionStorage.setItem(key, JSON.stringify(state));
    } catch {/* quota exceeded */}
  }, [key, state]);

  return [state, setState];
}
