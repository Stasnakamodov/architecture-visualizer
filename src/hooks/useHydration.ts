import { useEffect, useState } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';

/**
 * Hook to track Zustand store hydration state.
 * Use this to prevent hydration mismatch in Next.js.
 *
 * @example
 * const hasHydrated = useHydration();
 * if (!hasHydrated) return <LoadingSpinner />;
 * // Now safe to use persisted store data
 */
export function useHydration() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Check if store has already hydrated
    const hasHydrated = useCanvasStore.getState()._hasHydrated;
    if (hasHydrated) {
      setHydrated(true);
      return;
    }

    // Subscribe to hydration changes
    const unsubscribe = useCanvasStore.subscribe(
      (state) => {
        if (state._hasHydrated) {
          setHydrated(true);
        }
      }
    );

    return () => unsubscribe();
  }, []);

  return hydrated;
}

/**
 * Hook to get store state only after hydration.
 * Returns null before hydration, then returns the selector result.
 */
export function useHydratedStore<T>(selector: (state: ReturnType<typeof useCanvasStore.getState>) => T): T | null {
  const hasHydrated = useHydration();
  const value = useCanvasStore(selector);

  if (!hasHydrated) return null;
  return value;
}
