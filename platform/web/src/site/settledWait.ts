import { useEffect, useState } from 'react';

// Most authentication checks return faster than a person can perceive a change,
// so showing an indicator immediately only produces a flash. Nothing is drawn
// until the wait is long enough to be worth acknowledging.
const PLACEHOLDER_DELAY_MS = 250;

export function useSettledWait(waiting: boolean, delay = PLACEHOLDER_DELAY_MS): boolean {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!waiting) {
      setSettled(false);
      return;
    }
    const timer = window.setTimeout(() => setSettled(true), delay);
    return () => window.clearTimeout(timer);
  }, [waiting, delay]);
  return settled;
}
