import { useEffect, useState } from 'react';
import { fetchLatestMacosDownload, type MacosDownload } from '../release';
import { href } from '../router';
import { DisclosureDemo } from './DisclosureDemo';
import { DownloadIcon, LeonardoPlate, PotMark, RelayFigure } from './figures';
import { HeroReplay } from './HeroReplay';
import { useCopied } from './hooks';
import { proofOrigin, sealOrigin } from './PublicShell';
import { COPY, type CopyKey } from './replay';
import { XEmbed } from './XEmbed';

// Copy is verbatim from "Exalto Capture + Proof of Thought: website copy"
// (Capture section, Oct 14 2026) and audited by copy.test.tsx. Lines that are
// not in the doc are the ones the design handoff lists as new.

function Strip({ log, name, anchor }: { log: string; name: string; anchor: string }) {
  return (
    <div className="cp-strip" data-md="skip">
      <b>Log {log}</b>
      <span>{name}</span>
      <a href={`#${anchor}`}>#{anchor}</a>
    </div>
  );
}

function FigHead({ num, title, right }: { num: string; title: string; right: string }) {
  return (
    <div className="cp-fighead" data-md="fig">
      <span className="cp-fighead-num">Fig. {num}</span>
      <span className="cp-fighead-title">{title}</span>
      <span className="cp-fighead-right">{right}</span>
    </div>
  );
}

function CodeBox({
  command,
  copyKey,
  copied,
  copy,
}: {
  command: string;
  copyKey: CopyKey;
  copied: string;
  copy: (key: string, text: string) => void;
}) {
  return (
    <div className="cp-codebox">
      <code>
        <span className="cp-prompt">$ </span>
        {command}
      </code>
      <button type="button" onClick={() => copy(copyKey, COPY[copyKey])}>
        {copied === copyKey ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

const quickstart: Array<{
  title: string;
  note: React.ReactNode;
  key: CopyKey;
}> = [
  {
    title: 'Install the CLI and local service',
    note: (
      <>
        Apple silicon macOS or Linux. Prefer a guided setup?{' '}
        <a href={href('/docs/getting-started')}>Download the desktop app</a>.
      </>
    ),
    key: 'install',
  },
  {
    title: 'Start the local service',
    note: 'Provider proxy on 127.0.0.1:8787; dashboard and API on 127.0.0.1:8788. Capture is on by default.',
    key: 'start',
  },
  {
    title: 'Point your client at it',
    note: 'Routes for OpenAI, Anthropic, Codex, DeepSeek and OpenRouter are on from the first start.',
    key: 'base',
  },
  {
    title: 'Find the call',
    note: 'Lists what was recorded without decrypting a single checkpoint.',
    key: 'find',
  },
  {
    title: 'Seal it',
    note: 'Exalto Seal commits one portable .llmtrace package. Sealing is the only thing you pay for.',
    key: 'seal',
  },
  {
    title: 'Verify it',
    note: 'Verifies the notary evidence, the provider’s identity, the disclosed bytes and every hash. Anyone holding the package can run it.',
    key: 'verify',
  },
];

const packageEntries: Array<[string, string, string]> = [
  [
    '├── archive-manifest.json',
    '80',
    'The formats, then the path, size and SHA-256 of every entry.',
  ],
  [
    '├── evidence.tlsn',
    '82',
    'The TLSNotary presentation, the notary’s signature and the provider’s TLS identity.',
  ],
  [
    '├── manifest.json',
    '84',
    'The trace ID, the authenticated provider and host, the connection time and the notary key.',
  ],
  [
    '├── request.disclosed.http',
    '86',
    'What was sent: the request line, header names and body. Every header value is hidden.',
  ],
  [
    '├── response.disclosed.http',
    '88',
    'What came back: output, usage and tool calls, as the provider sent them.',
  ],
  ['└── trace.otlp.json', '90', 'The same exchange as a canonical OpenTelemetry trace.'],
];

const delanguePost = 'https://x.com/ClementDelangue/status/2108184948548976921';

export function Landing() {
  const [copied, copy] = useCopied();
  const [release, setRelease] = useState<MacosDownload | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchLatestMacosDownload().then((value) => {
      if (!cancelled) setRelease(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  // A link into a section (`/#quickstart`) lands on the landing with its
  // hash intact; the browser only scrolls to it on a document load.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView({ behavior: 'instant', block: 'start' });
  }, []);

  return (
    <main>
      <header id="top" className="cp-wrap cp-hero">
        <div className="cp-titleblock" data-md="skip">
          <div>
            <div className="cp-label">App and SDK</div>
            <div className="cp-titleblock-value">Exalto Capture</div>
          </div>
          <div>
            <div className="cp-label">What it is</div>
            <div className="cp-titleblock-value">The flight recorder for your AI work</div>
          </div>
          <div>
            <div className="cp-label">For agents</div>
            <a href="/llms.txt">capture.exalto.ai/llms.txt</a>
          </div>
          <div>
            <div className="cp-label">Overview</div>
            <div className="cp-titleblock-value cp-tabular">001</div>
          </div>
        </div>

        <h1 className="cp-h1">Sometimes the exchange itself is the evidence.</h1>

        <div className="cp-hero-row">
          <div className="cp-hero-copy">
            <p className="cp-label">
              Exalto Capture · You capture. A third party seals. Anyone can verify.
            </p>
            <p className="cp-lead">
              What an agent did, what a chatbot told you, what a paid API returned. Capture it on
              your side as it happens. Seal it. Anyone can verify.
            </p>
          </div>
          <div className="cp-hero-actions">
            <div className="cp-hero-buttons" data-md="inline">
              <a href={release?.url ?? href('/docs/getting-started')} className="cp-btn-primary">
                Download Exalto Capture
                <DownloadIcon />
              </a>
              <a href={href('/docs')} className="cp-btn-secondary">
                Read the docs
              </a>
            </div>
            <a href={`${sealOrigin}/verify`} className="cp-ulink">
              Verify a trace ↗
            </a>
            <p className="cp-hero-note">
              macOS 12+ on Apple silicon · CLI for macOS and Linux
              {release ? ` · ${release.version}` : ''}
            </p>
          </div>
        </div>

        <FigHead
          num="01"
          title="An eval run, on the record."
          right="Example trace replay · 15 Oct 2026"
        />
        <HeroReplay copied={copied} copy={copy} />
        <p className="cp-caption">
          A benchmark run through the local service. The harness keeps its API key, every exchange
          lands in your archive, and the one you cite gets sealed.
        </p>
      </header>

      <section id="recorder" className="cp-wrap cp-section" aria-label="The flight recorder">
        <Strip log="002" name="The flight recorder" anchor="recorder" />
        <div className="cp-recorder">
          <div className="cp-recorder-copy">
            <p className="cp-recorder-lead">
              Exalto Capture is the flight recorder for your AI work. Start it, point Claude Code,
              Codex, or your own tools at it, and every session is recorded on your machine,
              witnessed by the third-party "notary" (e.g. Exalto Seal) you select at setup. Nobody looks at it in normal operation.
              When something needs proof, seal the trace and hand it to anyone. Until that day, it’s
              just a folder on your computer that nobody, including the notary, can read.
            </p>
            <dl data-md="definitions">
              <div>
                <dt>Who it is for</dt>
                <dd>
                  Developers who ship agents, run evals, route models or sell tool calls, and anyone
                  who wants a record of their AI work that other people can verify.
                </dd>
              </div>
              <div>
                <dt>Why now</dt>
                <dd>
                  As agents take on more of the work, customers, reviewers, auditors and
                  counterparties will ask how a result was produced. Exalto Capture makes that evidence
                  simple to keep, share and verify, whether you ship agents or sign off on their
                  work.
                </dd>
              </div>
              <div>
                <dt>Pricing</dt>
                <dd className="cp-strong">
                  Local capture is free, always. You pay for what you seal.
                </dd>
              </div>
            </dl>
          </div>
          <LeonardoPlate />
        </div>
      </section>

      <section id="how-it-works" className="cp-wrap cp-section" aria-labelledby="how-title">
        <Strip log="003" name="How it works" anchor="how-it-works" />
        <div className="cp-how-open">
          <h2 id="how-title" className="cp-h2">
            A transcript or screenshot can be edited. A sealed trace is actual proof.
          </h2>
          <div className="cp-how-copy">
            <p className="cp-body">
              Anyone can edit a transcript or alter a screenshot. That’s why “here’s what the AI
              said” cannot be trusted.
            </p>
            <p className="cp-body cp-muted">
              Your session already runs over an encrypted, authenticated connection to
              the AI provider. The protocol relays that session through an independent "notary" (e.g. Exalto Seal) that
              witnesses exactly what crossed the wire without ever being able to read it. Using
              multiparty TLS, your machine and the notary split the session keys so the notary
              co-signs the encrypted traffic in real time without holding the decryption key, and
              when you selectively disclose an exchange later, the math proves it came from the
              provider while keeping your API keys and unshared work completely private. Old
              cryptography, pointed at a pressing new problem.
            </p>
          </div>
        </div>

        <RelayFigure />

        <div className="cp-box cp-establishes">
          <div className="cp-box-head">A sealed trace establishes</div>
          <div className="cp-cells">
            <div>
              <h3>Provenance</h3>
              <p>It came from a specific AI provider.</p>
            </div>
            <div>
              <h3>Integrity</h3>
              <p>It hasn’t been altered.</p>
            </div>
            <div>
              <h3>Time</h3>
              <p>It existed by that moment.</p>
            </div>
          </div>
        </div>
        <p className="cp-how-note">
          Nothing readable ever leaves your machine. Nobody, including us, sees your work. The
          cryptography is <a href="https://tlsnotary.org">TLSNotary</a>, open source. More in the{' '}
          <a href={href('/docs')}>spec</a>.
        </p>

        <div className="cp-disclose-head">
          <FigHead
            num="04"
            title="Disclose the exchange you want to share. Keep the rest."
            right="Interactive · reasoning-50"
          />
        </div>
        <div data-md-alt="Interactive demo: an archive of 50 exchanges, three of them disclosed. Disclosing one shows its request.disclosed.http (every header value hidden, body in the clear) and response.disclosed.http, with Provenance, Integrity and Time checks; changing one byte of the answer fails the integrity check.">
          <DisclosureDemo />
        </div>
        <p className="cp-caption">
          Header values are hidden in every sealed trace, so your API key never travels. Request and
          response bodies are what you can choose to disclose.
        </p>
      </section>

      <section id="quickstart" className="cp-wrap cp-section" aria-labelledby="qs-title">
        <Strip log="004" name="Quickstart" anchor="quickstart" />
        <div className="cp-qs-open">
          <h2 id="qs-title" className="cp-h2">
            From install to a sealed trace.
          </h2>
          <p>
            Keep the API key in your client and replace only its base URL. The local service relays
            the call, records it, and keeps the private checkpoint on your machine.
          </p>
        </div>
        <ol className="cp-qs-list" data-md="steps">
          {quickstart.map((step, index) => (
            <li key={step.key}>
              <span className="cp-qs-num">0{index + 1}</span>
              <div className="cp-qs-text">
                <h3 className="cp-h3-step">{step.title}</h3>
                <p>{step.note}</p>
              </div>
              <CodeBox command={COPY[step.key]} copyKey={step.key} copied={copied} copy={copy} />
            </li>
          ))}
        </ol>
        <p className="cp-qs-foot">
          Claude Code: <code>ANTHROPIC_BASE_URL=http://127.0.0.1:8787/anthropic claude</code>. Codex
          CLI uses the fixed /codex route. Every route is in{' '}
          <a href={href('/docs/getting-started')}>the docs</a>.
        </p>
      </section>

      <section id="components" className="cp-wrap cp-section cp-components" aria-labelledby="components-title">
        <Strip log="005" name="What Capture is" anchor="components" />
        <h2 id="components-title" className="cp-h2">
          The Exalto Capture Stack
        </h2>
        <div className="cp-components-table">
          <div className="cp-components-head" aria-hidden="true" data-md="skip">
            <span>Component</span>
            <span>What it does</span>
            <span>Who it is for</span>
          </div>
          <div id="app" className="cp-components-row">
            <h3 className="cp-h3-row">Exalto Capture Desktop App</h3>
            <p>
              The flight recorder. Record your AI exchanges as they happen, on your machine. Start
              it and after the initial setup work normally; every session lands here, on your machine. Free, always.
            </p>
            <p>Anyone with Claude Code, Codex, a chatbot or their own tools</p>
          </div>
          <div id="sdk" className="cp-components-row">
            <h3 className="cp-h3-row">Exalto Capture SDK and CLI</h3>
            <p>
              Build the flight recorder into your own products and services: capture, seal and
              verify from your code. The spec, the OpenTelemetry trace format and the offline
              verifier are all open source. <a href={href('/docs')}>The docs</a>.
            </p>
            <p>Developers, routers, eval and security teams</p>
          </div>
          <div id="seal" className="cp-components-row">
            <h3 className="cp-h3-row">Exalto Seal, the "notary"</h3>
            <p>
              Binds a trace to the provider, the time and the content, so anyone can verify it
              later. Share a link, and anyone can verify it too. The third party that countersigns
              and timestamps, and never sees plaintext. Sealing is the only thing you pay for;
              sealed traces and docs live at seal.exalto.ai.
            </p>
            <p>Everyone</p>
          </div>
          <div id="protocol" className="cp-components-row">
            <h3 className="cp-h3-row">The Exalto Capture Protocol (ECP)</h3>
            <p>The open protocol underneath all of it. Use Exalto’s Seal notary or run your own.</p>
            <p>Operators of compatible notaries; builders</p>
          </div>
        </div>
        <div className="cp-components-blocks">
          <div>
            <h3 className="cp-h3">An open protocol. A choice of who to seal with.</h3>
            <p>
              One open standard at the base. Tools, notaries, and apps stack on top. Exalto Seal is just
              one notary among many: seal with ours, with a third party’s, or with one you
              run for your organization.
            </p>
          </div>
          <div>
            <h3 className="cp-h3">Yours to build.</h3>
            <p>
              Sealed traces are a new primitive. The spec, the OpenTelemetry trace format, and the
              verifier are open.
            </p>
            <a href={href('/docs')} className="cp-ulink">
              → build on the protocol
            </a>
          </div>
        </div>

        <figure className="cp-package">
          <FigHead
            num="05"
            title="Inside a sealed trace."
            right=".llmtrace · six entries, in order"
          />
          <div className="cp-package-tree" data-md="package">
            <div className="cp-package-name">trc-8f3k2q.llmtrace</div>
            {packageEntries.map(([entry, num, description]) => (
              <div key={num} className="cp-package-row">
                <span className="cp-package-entry">{entry}</span>
                <span className="cp-package-leader" />
                <span className="cp-package-square" />
                <span className="cp-package-num">{num}</span>
                <span className="cp-package-desc">{description}</span>
              </div>
            ))}
          </div>
        </figure>
      </section>

      <section id="applications" className="cp-wrap cp-section" aria-labelledby="apps-title">
        <Strip log="006" name="Applications" anchor="applications" />
        <div className="cp-apps-open">
          <h2 id="apps-title" className="cp-h2-large">
            Sealed traces lower the cost of verification.
          </h2>
          <p>Cheap verification changes behavior and increases trust.</p>
        </div>

        <article id="research" className="cp-app">
          <div className="cp-app-head">
            <span className="cp-app-num">01</span>
            <h3 className="cp-h3">Traces for AI R&amp;D, evaluation and investigation</h3>
            <p className="cp-app-sub">Give others evidence they can verify.</p>
          </div>
          <div className="cp-app-body">
            <p>
              Researchers, builders and independent evaluators need to rely on traces from work they
              did not run themselves.
            </p>
            <p>
              The Exalto Capture CLI lets you capture and seal model requests and responses. Share
              the relevant run without opening your entire archive. Anyone can verify the origin and
              integrity of the disclosed exchanges.
            </p>
            <p>
              Back a benchmark result with the model, prompts and responses behind it. Publish an
              agent paper with traces reviewers can inspect. Give an outside investigator verifiable
              exchanges from a disputed run.
            </p>
            <p>
              In cybersecurity, this is how defenders learn: the instructions a model received, the
              responses it produced, the tool calls it requested. Sealed, those records can go to
              other teams without asking them to trust the source.
            </p>
            <XEmbed url={delanguePost} author="Clément Delangue" label="A post on X by" />
          </div>
        </article>

        <div className="cp-box cp-commit">
          <div className="cp-box-head">Commit, then verify</div>
          <p className="cp-commit-statement">
            Commit to the record before an incident. Verify it afterward.
          </p>
          <div className="cp-commit-body">
            <p>
              Publish a commitment to a defined set of traces on a regular schedule. Investigators
              can later check the disclosed records against that commitment and spot anything
              changed or missing from the committed set.
            </p>
            <p className="cp-muted">
              The labs currently control disclosure. Reviewers can independently check whether the
              disclosed evidence matches the earlier commitment.
            </p>
          </div>
        </div>

        <article id="routing" className="cp-app">
          <div className="cp-app-head">
            <span className="cp-app-num">02</span>
            <h3 className="cp-h3">Receipts for model routing and agentic commerce</h3>
            <p className="cp-app-sub">Receipts for what was served and what was delivered.</p>
          </div>
          <div className="cp-app-body">
            <p>
              Customers choose a provider and model configuration. Routers can use Exalto to seal
              the upstream exchange and link it to the customer’s request. The proof ties the
              response, including any reported configuration, to the provider’s authenticated
              endpoint.
            </p>
            <p>
              When an agent pays for a tool call over x402 or MPP, give both sides verifiable
              evidence of what came back. Seal the request and response, then link the dated
              exchange to the payment receipt. Buyers and sellers now have a record they can use in
              a dispute.
            </p>
            <p>
              The same applies to a shopping agent acting on a user’s mandate: connect the
              authorization, merchant terms and order confirmation to show what was approved, what
              was ordered and what was confirmed.
            </p>
          </div>
        </article>

        <article id="audited-commit" className="cp-app">
          <div className="cp-app-head">
            <span className="cp-app-num">03</span>
            <h3 className="cp-h3">The audited commit</h3>
            <p className="cp-app-sub">Provenance per commit, checkable by anyone with access.</p>
          </div>
          <div className="cp-app-body">
            <p>
              A pull request lands with a coding agent behind it. Change controls already require
              proof that someone reviewed it; with agents writing the code, the proof has to show
              what the human checked. The developer seals the session and links it from the commit:
              what the agent was asked, what it changed, what the developer verified. Provenance per
              commit, checkable by anyone with access. The same record answers a regulator or third-party years later, across every commit rather than a sample.
            </p>
            <p className="cp-strong">Works with Codex and Claude Code today.</p>
          </div>
        </article>

        <div className="cp-chips" role="group" aria-label="More uses" data-md="inline">
          <span className="cp-micro">More uses</span>
          <span className="cp-tag">the published eval</span>
          <span className="cp-tag">prompt-injection forensics</span>
        </div>
      </section>

      <section id="trust" className="cp-wrap cp-section cp-trust" aria-labelledby="trust-title">
        <Strip log="007" name="Trust model" anchor="trust" />
        <h2 id="trust-title" className="cp-h2">
          One trace proves what happened. Capture enforced across an organization also proves what
          didn’t.
        </h2>
        <div className="cp-box cp-trust-table" data-md="table">
          <div className="cp-trust-row cp-trust-head">
            <div>A sealed trace proves</div>
            <div>It cannot prove</div>
          </div>
          <div className="cp-trust-row">
            <p>
              The disclosed bytes traveled an authenticated connection with the named AI provider.
            </p>
            <p>
              On its own, that every interaction was disclosed.{' '}
              <b>With capture enforced across an organization, it can.</b>
            </p>
          </div>
          <div className="cp-trust-row">
            <p>They have not changed since capture.</p>
            <p>Who was behind the keyboard.</p>
          </div>
          <div className="cp-trust-row">
            <p>The named "notary" service witnessed them at the stated time.</p>
            <p>
              On its own, that no other AI or device was used.{' '}
              <b>Enforced capture closes that gap too.</b>
            </p>
          </div>
          <div className="cp-trust-row">
            <p>The exact timeline as it actually unfolded.</p>
            <p>That an output was correct, lawful, or wise.</p>
          </div>
        </div>
        <p className="cp-trust-note">
          A trace covers the interactions you capture, and for most uses that is what matters. Where
          completeness matters, enforce capture across the organization: then the record also shows
          what never happened.
        </p>
        <p className="cp-trust-more">
          Learn more: <a href={href('/docs/how-it-works')}>full trust model</a>
        </p>
      </section>

      <section id="agents" className="cp-wrap cp-section" aria-labelledby="agents-title">
        <Strip log="008" name="For agents" anchor="agents" />
        <div className="cp-agents-row">
          <div className="cp-agents-copy">
            <h2 id="agents-title" className="cp-h2">
              Hand this to your agent.
            </h2>
            <p>
              Paste it into Claude Code, Codex, or any agent with a shell. It installs Capture, adds
              the skill, and asks before it seals or shares anything.
            </p>
          </div>
          <div className="cp-promptbox">
            <div className="cp-promptbox-head" data-md="skip">
              <span className="cp-micro">Prompt</span>
              <button type="button" onClick={() => copy('prompt', COPY.prompt)}>
                {copied === 'prompt' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="cp-promptbox-body" data-md="code">
              {COPY.prompt.split('\n').map((line) => (
                <span key={line}>{line}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="cp-agents-rows" data-md="list">
          <div>
            <a href="/llms.txt">capture.exalto.ai/llms.txt</a>
            <p>
              This page, written for agents: what Capture does, the trust boundary, install, and the
              package layout.
            </p>
          </div>
          <div>
            <code>capture.exalto.ai/docs.md</code>
            <p>Every page has a markdown twin. Add .md to the address.</p>
          </div>
          <div>
            <code>capture skill install --target all</code>
            <p>
              The bundled Agent Skill teaches Claude Code and Codex to find captures, seal selected
              calls, verify traces, and ask before anything state-changing or public.
            </p>
          </div>
          <div>
            <code>127.0.0.1:8788/openapi.json</code>
            <p>The local service publishes its OpenAPI 3.1 contract. Add --json to any command.</p>
          </div>
          <div>
            <a href={href('/docs/agents')}>capture.exalto.ai/docs/agents</a>
            <p>
              The procedure, step by step, with the command and the field that proves each step
              worked, and what to ask before.
            </p>
          </div>
        </div>
      </section>

      <section id="proof-of-thought" className="cp-wrap cp-section" aria-labelledby="pot-title">
        <Strip log="009" name="Powered by Capture" anchor="proof-of-thought" />
        <div className="cp-pot cp-paper">
          <PotMark size={56} />
          <div className="cp-pot-copy">
            <h2 id="pot-title">Proof of Thought.</h2>
            <p>
              A scratchpad for thinking and editing with AI that shows what you contributed and what
              the model did. Every scratchpad has a flight recorder underneath; its seals come from
              Seal.
            </p>
          </div>
          <a href={proofOrigin}>→ proof.exalto.ai</a>
        </div>
        <div className="cp-cells cp-sig" data-md="inline">
          <div>
            <div className="cp-micro">Captured by</div>
            <div className="cp-sig-value">You</div>
          </div>
          <div>
            <div className="cp-micro">Sealed by</div>
            <div className="cp-sig-value">Exalto Seal</div>
          </div>
          <div>
            <div className="cp-micro">Verified by</div>
            <div className="cp-sig-value">Anyone</div>
          </div>
        </div>
        <h2
          className="cp-closing"
          aria-label="Capture. Seal. Verify."
          data-md-alt="Capture. Seal. Verify."
        >
          <span>Capture.</span>
          <span>Seal.</span>
          <span>
            Verify<i>.</i>
          </span>
        </h2>
      </section>
    </main>
  );
}
