import { useState, useEffect } from 'react';

/**
 * Returns a debounced version of `value` that only updates after
 * `delayMs` milliseconds have elapsed since the last change.
 *
 * @param value   - The value to debounce
 * @param delayMs - Delay in milliseconds (e.g. 300)
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);

  return debouncedValue;
}
