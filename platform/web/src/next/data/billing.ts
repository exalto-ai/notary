import { useEffect, useRef, useState } from 'react';
import { getBillingPurchase } from '../../platform-api/client';

export type BillingPurchase = Awaited<ReturnType<typeof getBillingPurchase>>;

export type CheckoutOutcome =
  | 'waiting'
  | 'cancelled'
  | 'timeout'
  | 'paid'
  | 'failed'
  | 'refunded'
  | 'disputed';

export const checkoutMessages: Record<CheckoutOutcome, string> = {
  waiting: 'Payment received. Waiting for Stripe to confirm it.',
  cancelled: 'Checkout was cancelled. Nothing was charged.',
  timeout:
    'Stripe has not confirmed this payment yet. Check the purchase list, or reload in a minute.',
  paid: 'Payment confirmed. The sealing you bought is on your balance.',
  failed: 'Payment was not completed. No sealing was added.',
  refunded: 'This payment was refunded, so the sealing it bought is no longer available.',
  disputed: 'This payment is disputed, so the sealing it bought is unavailable for now.',
};

const settled: BillingPurchase['state'][] = ['paid', 'failed', 'refunded', 'disputed'];

export function isSettled(state: BillingPurchase['state']): boolean {
  return settled.includes(state);
}

/**
 * Stripe redirects back before its webhook has necessarily landed, so the
 * purchase is polled until it settles. The wait backs off and then gives up
 * with something the reader can act on, because a spinner that never ends is
 * worse than an honest "not yet".
 */
export function useCheckoutReturn({
  checkout,
  purchaseId,
  onSettled,
  loadPurchase = getBillingPurchase,
  baseDelay = 1_000,
  maxAttempts = 8,
}: {
  checkout: string | null;
  purchaseId: string | null;
  onSettled: (purchase: BillingPurchase) => void;
  loadPurchase?: typeof getBillingPurchase;
  baseDelay?: number;
  maxAttempts?: number;
}): { outcome: CheckoutOutcome | null; error: string | null } {
  const [outcome, setOutcome] = useState<CheckoutOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Held in a ref rather than a dependency: a caller that rebuilds this
  // callback each render must not restart a poll that is already running.
  const settledHandler = useRef(onSettled);
  settledHandler.current = onSettled;

  useEffect(() => {
    if (checkout === 'cancelled') {
      setOutcome('cancelled');
      return;
    }
    if (checkout !== 'success' || !purchaseId) {
      setOutcome(null);
      return;
    }

    let cancelled = false;
    let timer: number | undefined;
    let attempts = 0;
    setOutcome('waiting');

    const again = (poll: () => Promise<void>) => {
      if (attempts >= maxAttempts) {
        setOutcome('timeout');
        return;
      }
      timer = window.setTimeout(poll, Math.min(baseDelay * 2 ** Math.min(attempts - 1, 3), 5_000));
    };

    const poll = async () => {
      attempts += 1;
      try {
        const purchase = await loadPurchase(purchaseId);
        if (cancelled) return;
        setError(null);
        settledHandler.current(purchase);
        if (isSettled(purchase.state)) {
          setOutcome(purchase.state as CheckoutOutcome);
          return;
        }
        again(poll);
      } catch (reason) {
        if (cancelled) return;
        if (attempts >= maxAttempts) {
          setOutcome('timeout');
          setError(reason instanceof Error ? reason.message : 'Could not reach Stripe.');
        } else {
          again(poll);
        }
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [checkout, purchaseId, loadPurchase, baseDelay, maxAttempts]);

  return { outcome, error };
}
