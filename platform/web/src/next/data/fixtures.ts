// Prototype data. Shapes follow the hosted API but no value here is evidence.

import type { CustodyStep } from '../components/primitives';
import type { Line } from '../components/TraceRecord';

export const account = {
  name: 'Kev Zhang',
  identifier: 'kev@exalto.ai',
  provider: 'Google',
};

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

export type TraceRow = {
  id: string;
  title: string;
  provider: string;
  model: string;
  state: 'shared' | 'verifying' | 'expired' | 'stopped';
  sealedAt: string;
  access: string;
  sharedAt: string;
  bytes: number;
  messages: number;
  digest: string;
};

export const traces: TraceRow[] = [
  {
    id: 'trc_8Qm2Vd',
    title: 'Reviewing the retry policy',
    provider: 'api.anthropic.com',
    model: 'claude-sonnet-4-6',
    state: 'shared',
    access: 'Unlisted link',
    sealedAt: '14:04 UTC',
    sharedAt: '2026-09-22 14:06 UTC',
    bytes: 412_880,
    messages: 12,
    digest: '9f2c81b4…a417',
  },
  {
    id: 'trc_4Kx9Lp',
    title: 'Migration plan for the public link domain',
    provider: 'api.openai.com',
    model: 'gpt-5.2',
    state: 'shared',
    access: 'Listed, password required',
    sealedAt: '09:38 UTC',
    sharedAt: '2026-09-19 09:41 UTC',
    bytes: 1_204_336,
    messages: 34,
    digest: '31ba07de…c092',
  },
  {
    id: 'trc_7Zt1Rw',
    title: 'What a sealed trace actually proves',
    provider: 'api.anthropic.com',
    model: 'claude-opus-4-2',
    state: 'verifying',
    access: 'Unlisted link',
    sealedAt: 'in progress',
    sharedAt: '2026-09-23 08:12 UTC',
    bytes: 96_512,
    messages: 6,
    digest: 'pending',
  },
  {
    id: 'trc_2Hs6Nq',
    title: 'Draft essay, second pass',
    provider: 'api.deepseek.com',
    model: 'deepseek-v4',
    state: 'expired',
    access: 'Expired 2026-09-15',
    sealedAt: '17:18 UTC',
    sharedAt: '2026-08-15 17:20 UTC',
    bytes: 733_104,
    messages: 21,
    digest: 'c7104fa2…88de',
  },
];

export const devices = [
  {
    id: 'dev_1',
    name: 'Kev\u2019s MacBook Pro',
    detail: 'Exalto Capture 0.1.9, macOS 27.0',
    lastSeen: '4 minutes ago',
    current: true,
  },
  {
    id: 'dev_2',
    name: 'build-runner-3',
    detail: 'notaryd 0.1.8, Linux',
    lastSeen: '2026-09-21 03:14 UTC',
    current: false,
  },
];

export const apiKeys = [
  {
    id: 'key_1',
    name: 'CI sealing',
    prefix: 'exk_9f2c',
    created: '2026-07-02',
    lastUsed: '2026-09-22',
    state: 'Active' as const,
  },
  {
    id: 'key_2',
    name: 'Laptop scratch',
    prefix: 'exk_41bd',
    created: '2026-04-18',
    lastUsed: 'never',
    state: 'Revoked' as const,
  },
];

export const usage = {
  plan: 'Free',
  status: 'active',
  resetsAt: '2026-10-08',
  capture: { used: 18_400_000, total: 50_000_000 },
  sealing: { used: 41_200_000, total: 50_000_000 },
  storage: { used: 2_446_832, total: 1_000_000_000 },
};

export const sealingByDay = [
  0, 0, 1.2, 0, 0, 3.4, 2.1, 0, 0, 0, 5.6, 1.1, 0, 0, 2.8, 0, 0, 0, 4.2, 6.1, 0, 0, 1.4, 0, 3.9, 0,
  0, 2.2, 5.1, 2.9,
];

export const purchases = [
  { id: 'pur_1', when: '2026-08-02', what: '1 GB sealing', amount: '$9.99', state: 'Completed' },
  { id: 'pur_2', when: '2026-06-14', what: '1 GB sealing', amount: '$9.99', state: 'Completed' },
];
