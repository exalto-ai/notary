// The trace shown on the landing page. It is an illustration of the product's
// unit, written as page copy, not a stand-in for anyone's account.

import type { CustodyStep } from '../components/primitives';
import type { Line } from '../components/TraceRecord';

export const heroTrace = {
  title: 'Reviewing the retry policy',
  status: 'sealed' as const,
  provider: 'api.anthropic.com',
  model: 'claude-sonnet-4-6',
  witnessed: '2026-09-22 14:02:11 UTC',
  digest: '9f2c…a417',
  lines: [
    { speaker: 'you', text: 'Review this retry policy for a payment webhook.' },
    {
      speaker: 'model',
      text: 'Retry transient failures with exponential backoff, and require an idempotency key so a repeated delivery cannot charge twice.',
    },
    { speaker: 'you', sealed: [7, 4, 11, 6, 9] },
    { speaker: 'model', sealed: [5, 12, 8, 6, 14, 4, 9, 7] },
  ] satisfies Line[],
  custody: [
    { label: 'Recorded', detail: '14:02 on this Mac', reached: true, tone: 'local' },
    { label: 'Sealed', detail: '14:06 by Seal', reached: true, tone: 'sealed' },
    { label: 'Shared', detail: 'not shared', reached: false },
  ] satisfies CustodyStep[],
};
