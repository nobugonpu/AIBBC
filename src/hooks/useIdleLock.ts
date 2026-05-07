import { useEffect, useRef } from 'react';

const IDLE_EVENTS: (keyof WindowEventMap)[] = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'wheel',
];

/**
 * Calls onLock() after `timeoutMs` of user inactivity.
 * Activity is detected via mouse, keyboard, touch, and scroll events on window.
 * The timer resets on each detected event.
 */
export function useIdleLock(timeoutMs: number, onLock: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onLockRef = useRef(onLock);
  onLockRef.current = onLock;

  useEffect(() => {
    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => onLockRef.current(), timeoutMs);
    };

    reset();
    IDLE_EVENTS.forEach(ev => window.addEventListener(ev, reset, { passive: true }));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      IDLE_EVENTS.forEach(ev => window.removeEventListener(ev, reset));
    };
  }, [timeoutMs]);
}
