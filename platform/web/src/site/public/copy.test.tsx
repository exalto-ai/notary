import '../styles';

import { MantineProvider } from '@mantine/core';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { App } from '../App';
import { landingTitle } from '../documentTitle';
import { cssVariablesResolver, theme } from '../theme';

// The landing copy audit. The strings come verbatim from "Exalto Capture +
// Proof of Thought: website copy" (Capture section, Oct 14 2026) by way of the
// design handoff's check-copy-capture.mjs, and are checked against the
// rendered page rather than the source, so a line cannot go missing by being
// moved, split or shadowed by a component.

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState({}, '', '/');
});

const normalize = (source: string) =>
  source
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ');

const banned: Array<[RegExp, string]> = [
  [/notariz/i, 'notarize/notarization (say seal/sealing)'],
  [/finaliz/i, 'finaliz* (retired vocabulary; say seal)'],
  [/tamper-proof/i, 'tamper-proof (say tamper-evident)'],
  [/perfect audit trail/i, 'perfect audit trail'],
  [/\boracle\b/i, 'oracle'],
  [/human-authored/i, 'human-authored'],
  [/court-ready/i, 'court-ready'],
  [/guaranteed compliance/i, 'guaranteed compliance'],
  [/[—–]/, 'em- or en-dash in rendered copy'],
];

const required = [
  'Sometimes the exchange itself is the evidence.',
  'Exalto Capture · You capture. A third party seals. Anyone can verify.',
  'What a chatbot told you, what an agent did, what a paid API returned. Capture it on your machine as it happens. Seal it. Anyone can verify.',
  'Download Exalto Capture',
  'Read the docs',
  'Verify a trace',
  "Exalto Capture is the flight recorder for your AI work. Start it, point Claude Code, Codex, or your own tools at it, and every session is recorded on your machine, witnessed by the notary you select at setup. Nobody looks at it in normal operation. When something needs proof, seal the trace and hand it to anyone. Until that day, it's just a folder on your computer that nobody, including the notary, can read.",
  'Developers who ship agents, run evals, route models or sell tool calls, and anyone who wants a record of their AI work that other people can verify.',
  'As agents take on more of the work, customers, reviewers, auditors and counterparties will ask how a result was produced. Exalto makes that evidence simple to keep, share and verify, whether you ship agents or sign off on their work.',
  'Local capture is free, always. You pay for what you seal.',
  'Sealed traces make verification cheap.',
  'Cheap verification changes behavior and increases trust.',
  'Traces for AI R&D, evaluation and investigation',
  'Give others evidence they can verify.',
  'Researchers, builders and independent evaluators need to rely on traces from work they did not run themselves.',
  'The Exalto Capture CLI lets you capture and seal model requests and responses. Share the relevant run without opening your entire archive. Anyone can verify the origin and integrity of the disclosed exchanges.',
  'Back a benchmark result with the model, prompts and responses behind it. Publish an agent paper with traces reviewers can inspect. Give an outside investigator verifiable exchanges from a disputed run.',
  'In cybersecurity, this is how defenders learn: the instructions a model received, the responses it produced, the tool calls it requested. Sealed, those records can go to other teams without asking them to trust the source.',
  'Commit to the record before an incident. Verify it afterward.',
  'Publish a commitment to a defined set of traces on a regular schedule. Investigators can later check the disclosed records against that commitment and spot anything changed or missing from the committed set.',
  'The labs currently control disclosure. Reviewers can independently check whether the disclosed evidence matches the earlier commitment.',
  'Receipts for model routing and agentic commerce',
  'Receipts for what was served and what was delivered.',
  "Customers choose a provider and model configuration. Routers can use Exalto to seal the upstream exchange and link it to the customer's request. The proof ties the response, including any reported configuration, to the provider's authenticated endpoint.",
  'When an agent pays for a tool call over x402 or MPP, give both sides verifiable evidence of what came back. Seal the request and response, then link the dated exchange to the payment receipt. Buyers and sellers now have a record they can use in a dispute.',
  "The same applies to a shopping agent acting on a user's mandate: connect the authorization, merchant terms and order confirmation to show what was approved, what was ordered and what was confirmed.",
  'The audited commit',
  'Provenance per commit, checkable by anyone with access.',
  'A pull request lands with a coding agent behind it. Change controls already require proof that someone reviewed it; with agents writing the code, the proof has to show what the human checked. The developer seals the session and links it from the commit: what the agent was asked, what it changed, what the developer verified. Provenance per commit, checkable by anyone with access. The same record answers a regulator or an acquirer years later, across every commit rather than a sample.',
  'Works with Codex and Claude Code today.',
  'the published eval',
  'prompt-injection forensics',
  'A transcript is just text. A sealed trace is proof.',
  'Anyone can type a transcript, edit one, screenshot one. That\'s why "here\'s what the AI said" does not count.',
  'The insight: your session already runs over an encrypted, authenticated connection to the AI provider. The protocol relays that session through an independent notary that witnesses exactly what crossed the wire without ever being able to read it. Using multiparty TLS, your machine and the notary split the session keys so the notary co-signs the encrypted traffic in real time without holding the decryption key, and when you selectively disclose an exchange later, the math proves it came from the provider while keeping your API keys and unshared work completely private. Old cryptography, pointed at a new problem.',
  'A sealed trace establishes',
  'Provenance It came from that AI provider.',
  "Integrity It hasn't been changed.",
  'Time It existed by that moment.',
  'Nothing readable ever leaves your machine. Nobody, including us, sees your work. The cryptography is TLSNotary , open source. More in the spec .',
  'What Capture is',
  'Exalto Capture, the app (desktop) The flight recorder. Record your AI exchanges as they happen, on your machine. Start it and work normally; every session lands here, on your machine. Free, always. Anyone with Claude Code, Codex, a chatbot or their own tools',
  'Capture SDK and CLI Build the flight recorder into your own products and services: capture, seal and verify from your code. The spec, the OpenTelemetry trace format and the offline verifier are open. The docs . Developers, routers, eval and security teams',
  'Exalto Seal, the notary Binds a trace to the provider, the time and the content, so anyone can verify it later. Share a link, and anyone can verify it too. The third party that countersigns and timestamps, and never sees plaintext. Sealing is the only thing you pay for; sealed traces and docs live at seal.exalto.ai. Everyone; the default notary at setup',
  "The open protocol (ECP) The open protocol underneath all of it. Use Exalto's notary or run your own. Operators of compatible notaries; builders",
  'An open protocol. A choice of notary.',
  "One standard at the base. Tools, notaries, and apps stack on top. Exalto Seal is just one notary among many to come: seal with ours, with a third party's, or with one you run yourself.",
  'Yours to build.',
  'Sealed traces are a new primitive. The spec, the OpenTelemetry trace format, and the verifier are open.',
  '→ build on the protocol',
  "One trace proves what happened. Capture enforced across an organization also proves what didn't.",
  'A sealed trace proves',
  'It cannot prove',
  'The disclosed bytes traveled an authenticated connection with the named AI provider.',
  'On its own, that every interaction was disclosed. With capture enforced across an organization, it can.',
  'They have not changed since capture.',
  'Who was behind the keyboard.',
  'The named notary witnessed them at the stated time.',
  'On its own, that no other AI or device was used. Enforced capture closes that gap too.',
  'The exact timeline as it actually unfolded.',
  'That an output was correct, lawful, or wise.',
  'A trace covers the interactions you capture, and for most uses that is what matters. Where completeness matters, enforce capture across the organization: then the record also shows what never happened.',
  'Learn more: full trust model',
  'Proof of Thought. A scratchpad for thinking and editing with AI that shows what you contributed and what the model did. Every scratchpad has a flight recorder underneath; its seals come from Seal. → proof.exalto.ai',
  'Spec GitHub Registry Traces Verify a trace Privacy Terms',
  'Exalto Seal is not a notary public. Sealing is not a notarial act. A receipt is cryptographic evidence, not a legal instrument. The ECP specification uses "notary" as a technical role term, in the way public-key infrastructure uses "certificate authority." Built on TLSNotary.',
  'App SDK Protocol Seal Docs Proof of Thought ↗',
];

test('the landing carries the website copy verbatim and nothing retired', async () => {
  vi.stubGlobal('fetch', async () => new Response('', { status: 404 }));
  render(
    <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver} env="test">
      <App />
    </MantineProvider>,
  );
  await expect
    .element(page.getByRole('heading', { name: 'Sometimes the exchange itself is the evidence.' }))
    .toBeVisible();
  expect(document.title).toBe(landingTitle);

  const text = normalize(document.body.innerHTML);
  const missing = required.filter((value) => !text.includes(value));
  expect(missing, `missing required copy: ${JSON.stringify(missing)}`).toEqual([]);
  const present = banned.filter(([pattern]) => pattern.test(text)).map(([, label]) => label);
  expect(present, `banned copy on the page: ${present.join(', ')}`).toEqual([]);
  expect(required.length).toBe(67);
});
