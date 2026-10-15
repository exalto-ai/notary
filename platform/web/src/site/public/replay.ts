// Interaction data for the landing page: the hero replay, its receipt, the
// disclosure demo and the copy strings. Ported from the design handoff's
// reference/interactions.js; every value is illustrative and labelled as such
// on the page.

export type LineKind = 'cmd' | 'out' | 'ok' | 'gap';
export type ScriptLine = readonly [LineKind, string, number];

// [kind, text, step]. Steps: 0 Capture, 1 Run, 2 Find, 3 Seal, 4 Verify.
export const SCRIPT: readonly ScriptLine[] = [
  ['cmd', 'capture status', 0],
  ['out', 'service    running · proxy 127.0.0.1:8787 · admin 127.0.0.1:8788', 0],
  ['out', 'notary     Exalto Seal', 0],
  ['out', 'capture    on', 0],
  ['gap', '', 0],
  ['cmd', 'export OPENAI_BASE_URL=http://127.0.0.1:8787/openai/v1', 1],
  ['cmd', 'python run_eval.py --suite reasoning-50 --model gpt-5', 1],
  ['out', '50/50 items · 43 correct · 50 exchanges captured', 1],
  ['gap', '', 1],
  ['cmd', 'capture traces list --query "Item 37" --metadata-only', 2],
  ['out', 'trc-8f3k2q   openai   gpt-5   200   14:03:52   captured', 2],
  ['gap', '', 2],
  ['cmd', 'capture traces seal trc-8f3k2q --wait', 3],
  ['out', 'queued · running · authenticated transcript 6.2 KB', 3],
  ['out', 'commitments 6/6 · succeeded', 3],
  ['out', 'wrote trc-8f3k2q.llmtrace', 3],
  ['gap', '', 3],
  ['cmd', 'capture traces verify trc-8f3k2q', 4],
  ['ok', 'provenance   api.openai.com over authenticated TLS', 4],
  ['ok', 'integrity    package hashes match', 4],
  ['ok', 'time         witnessed by Exalto Seal at 14:03:52 UTC', 4],
];

export const STEP_NAMES = ['Capture', 'Run', 'Find', 'Seal', 'Verify'] as const;

export const TIMING = {
  startDelay: 450,
  typeChars: 2,
  typeTick: 24,
  afterCommand: 420,
  afterOutput: 150,
  afterGap: 60,
  stepBoundary: 650,
  visibleThreshold: 0.3,
} as const;

/** End index (exclusive) of each step: jumping to step s sets i = ends[s]. */
export function stepEnds(script: readonly ScriptLine[] = SCRIPT): number[] {
  const ends = [0, 0, 0, 0, 0];
  script.forEach((line, index) => {
    ends[line[2]] = index + 1;
  });
  return ends;
}

/** Delay after line i is fully revealed. */
export function delayAfter(script: readonly ScriptLine[], i: number): number {
  const line = script[i];
  const next = script[i + 1];
  let delay =
    line[0] === 'cmd'
      ? TIMING.afterCommand
      : line[0] === 'gap'
        ? TIMING.afterGap
        : TIMING.afterOutput;
  if (next && next[2] !== line[2]) delay += TIMING.stepBoundary;
  return delay;
}

/** Receipt phase from steps completed: 0 Recording, 1 Captured, 2 Sealed, 3 Verified. */
export function receiptPhase(stepsDone: number): 0 | 1 | 2 | 3 {
  return stepsDone >= 5 ? 3 : stepsDone >= 4 ? 2 : stepsDone >= 2 ? 1 : 0;
}

export type ReceiptTag = 'outline-accent' | 'outline-ink' | 'fill-ink';
export type Receipt = {
  state: string;
  tag: ReceiptTag;
  id: string;
  meta: string;
  prov: string;
  integ: string;
  time: string;
  mark: string;
  note: string;
  link: string;
  sealed: boolean;
};

const META = 'reasoning-50 · Item 37 · openai · gpt-5';
export const RECEIPT: readonly Receipt[] = [
  {
    state: 'Recording',
    tag: 'outline-accent',
    id: 'No trace yet',
    meta: 'Capture is on · notary: Exalto Seal',
    prov: 'Not sealed',
    integ: 'Not sealed',
    time: 'Not sealed',
    mark: '·',
    note: 'Every exchange that passes through the local service lands here, on your machine.',
    link: 'Not sealed yet',
    sealed: false,
  },
  {
    state: 'Captured',
    tag: 'outline-ink',
    id: 'trc-8f3k2q',
    meta: META,
    prov: 'Seal to establish',
    integ: 'Seal to establish',
    time: 'Seal to establish',
    mark: '·',
    note: 'A private checkpoint, encrypted on your machine. Nobody, including the notary, can read it.',
    link: 'Not sealed yet',
    sealed: false,
  },
  {
    state: 'Sealed',
    tag: 'fill-ink',
    id: 'trc-8f3k2q',
    meta: META,
    prov: 'api.openai.com · authenticated TLS',
    integ: 'sha256 9c41…e07b · 6 entries',
    time: '14:03:52 UTC · Exalto Seal',
    mark: '·',
    note: 'Sealed into one portable .llmtrace package. Hand it to anyone.',
    link: 'seal.exalto.ai/trc-8f3k2q',
    sealed: true,
  },
  {
    state: 'Verified',
    tag: 'fill-ink',
    id: 'trc-8f3k2q',
    meta: META,
    prov: 'api.openai.com · authenticated TLS',
    integ: 'sha256 9c41…e07b · 6 entries',
    time: '14:03:52 UTC · Exalto Seal',
    mark: '✓',
    note: 'Verified against the notary’s public key. Anyone can verify.',
    link: 'seal.exalto.ai/trc-8f3k2q',
    sealed: true,
  },
];

export type Item = {
  n: number;
  label: string;
  q: string;
  a: string;
  tampered: string;
  time: string;
  id: string;
};

/** Fifty deterministic eval items. Item 37 is the hero's trace. */
export function makeItems(): Item[] {
  const pad = (value: number) => String(value).padStart(2, '0');
  const items: Item[] = [];
  for (let n = 1; n <= 50; n++) {
    let q: string;
    let a: string;
    if (n % 3 === 1) {
      const x = 12 + n;
      const y = 7 + (n % 9);
      q = `What is ${x} × ${y}?`;
      a = String(x * y);
    } else if (n % 3 === 2) {
      const r = 4 + (n % 6);
      const k = 6 + (n % 5);
      const b = 3 + (n % 7);
      q = `A crate holds ${r} rows of ${k} jars. ${b} jars break. How many are left?`;
      a = String(r * k - b);
    } else {
      const h = 7 + (n % 9);
      const m = (n * 7) % 60;
      const d = 45 + ((n * 11) % 120);
      const t = h * 60 + m + d;
      q = `A train leaves at ${h}:${pad(m)} and arrives ${d} minutes later. When does it arrive?`;
      a = `${Math.floor(t / 60)}:${pad(t % 60)}`;
    }
    const tampered = a.slice(0, -1) + String((Number(a.slice(-1)) + 1) % 10);
    const s = 84 + n * 4;
    const time = `14:${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
    const id =
      n === 37
        ? 'trc-8f3k2q'
        : `trc-${((n * 48271 + 1013904223) % 2176782336).toString(36).padStart(6, '0').slice(-6)}`;
    items.push({ n, label: pad(n), q, a, tampered, time, id });
  }
  return items;
}

export type Disclosure = { disclosed: number[]; focus: number; tamper: boolean };
export const DISCLOSURE_DEFAULT: Disclosure = { disclosed: [12, 29, 37], focus: 37, tamper: false };

/**
 * Click semantics: a private cell is disclosed and focused; a disclosed cell
 * that is not focused becomes focused; the focused disclosed cell goes private.
 */
export function clickItem(state: Disclosure, n: number): Disclosure {
  const disclosed = new Set(state.disclosed);
  if (disclosed.has(n) && state.focus === n) disclosed.delete(n);
  else disclosed.add(n);
  return { ...state, disclosed: Array.from(disclosed).sort((x, y) => x - y), focus: n };
}

export const requestBody = (item: Item) => `{"model":"gpt-5","input":"Item ${item.n}. ${item.q}"}`;
export const verdict = (item: Item, tampered: boolean) =>
  `capture traces verify ${item.id}${tampered ? ' · fails at integrity' : ' · passes'}`;

export const COPY = {
  install: 'curl -fsSL https://capture.exalto.ai/install.sh | sh',
  start: 'captured',
  base: 'export OPENAI_BASE_URL=http://127.0.0.1:8787/openai/v1',
  find: 'capture traces list --provider openai --limit 20',
  seal: 'capture traces seal trc-8f3k2q --wait',
  verify: 'capture traces verify trc-8f3k2q',
  receipt: 'https://seal.exalto.ai/trc-8f3k2q',
  prompt: [
    'Set up Exalto Capture on this machine. Read https://capture.exalto.ai/llms.txt first.',
    'Install the CLI: curl -fsSL https://capture.exalto.ai/install.sh | sh',
    'Add the skill: capture skill install --target all',
    'Start the local service: captured',
    'Check it: capture --json status',
    'Ask me before you seal a trace, connect an account, or share anything.',
  ].join('\n'),
} as const;

export type CopyKey = keyof typeof COPY;
export const COPIED_MS = 1600;
