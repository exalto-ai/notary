// Copy audit for the exalto.ai landing page. Enforces the QA checklist from
// the design handoff: banned vocabulary absent, required doctrine strings
// present verbatim, live capture always badged, and no em- or en-dashes in
// rendered copy. Runs before every build.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const llms = readFileSync(resolve(root, 'public/llms.txt'), 'utf8');
const text = html.replace(/<[^>]+>/g, '');

const failures = [];

const banned = [
  [/notariz/i, 'notarize/notarization (say seal/sealing)'],
  [/finaliz/i, 'finaliz* (retired vocabulary; say seal)'],
  [/checkpoint/i, 'checkpoint (reserved for the runtime private capture state)'],
  [/only a fingerprint/i, 'only a fingerprint (the notary relays and witnesses ciphertext)'],
  [/any API/i, 'any API (say supported providers)'],
  [/open and audited/i, 'open and audited (no audit claim)'],
  [/tamper-proof/i, 'tamper-proof (say tamper-evident)'],
  [/perfect audit trail/i, 'perfect audit trail'],
  [/\boracle\b/i, 'oracle'],
  [/human-authored/i, 'human-authored (say tracked local contribution)'],
  [/guaranteed compliance/i, 'guaranteed compliance'],
  [/court-ready/i, 'court-ready'],
  [/preserves privilege/i, 'preserves privilege'],
  [/receipts for AI work/i, 'receipts for AI work'],
  [/Was this AI/i, 'Was this AI'],
  [/[—–]/, 'em- or en-dash in rendered copy'],
];
for (const [pattern, label] of banned) {
  for (const [name, source] of [
    ['index.html', html],
    ['llms.txt', llms],
  ]) {
    if (pattern.test(source)) failures.push(`${name} contains banned copy: ${label}`);
  }
}

const required = [
  'Exalto Seal is not a notary public. Sealing is not a notarial act. A receipt is cryptographic evidence, not a legal instrument. The ENP specification uses "notary" as a technical role term, in the way public-key infrastructure uses "certificate authority."',
  'A trace proves presence, never absence.',
  "Exalto Seal is one notary among many: seal with ours, with a third party's, or with one you run yourself.",
  'we never meter it',
  'Built on TLSNotary',
  'The session already happens. Everything in blue is what the protocol adds: the witness in its path, the receipt, the portable trace.',
  'Nothing readable ever leaves your machine.',
  'The named notary witnessed them at the stated time.',
];
for (const value of required) {
  if (!text.includes(value)) failures.push(`index.html is missing required copy: ${JSON.stringify(value)}`);
}

if (/live capture(?!\s*\(coming soon\))/i.test(text)) {
  failures.push('index.html mentions live capture without "(coming soon)"');
}

const tileOrder = [
  'Proof of Thought',
  'The flagged essay',
  'The audited commit',
  'The certified filing',
  'The agent flight recorder',
  'The discovery archive',
  'The published eval',
  'The take-home',
  'Yours to build',
];
const gridStart = html.indexOf('class="app-grid"');
let cursor = gridStart;
for (const title of tileOrder) {
  const next = html.indexOf(`<h3>${title}</h3>`, cursor);
  if (next === -1) {
    failures.push(`applications grid is missing or misorders the tile: ${title}`);
    break;
  }
  cursor = next;
}

if (!/61<span>%<\/span>/.test(html) || !text.includes('verified human share')) {
  failures.push('Thought Score must show 61% with the "verified human share" claim');
}

if (failures.length) {
  for (const failure of failures) process.stderr.write(`${failure}\n`);
  process.exit(1);
}
process.stdout.write('Landing copy matches the handoff QA checklist.\n');
