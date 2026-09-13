import { useEffect, useState } from 'react';
import { websiteHref } from './origins';
import { downloadSize, fetchLatestMacosDownload, type MacosDownload } from './release';

// The root of capture.exalto.ai sells one thing: the macOS app. The wider
// Exalto story, public traces, and the registry live on exalto.ai, so this
// page stays on Capture and hands off with links rather than repeating them.

const CAPTURE_ROWS = [
  {
    who: 'YOU',
    at: 'AUG 24 · 13:58',
    text: 'Read the draft as a skeptic. What would you flag first?',
  },
  {
    who: 'MODEL',
    at: 'AUG 24 · 13:58',
    text: 'The conclusion overreaches by one adverb, and paragraph 6 cites a study without its replication failure.',
  },
  {
    who: 'YOU',
    at: 'AUG 24 · 14:02',
    text: 'Give me the strongest counter-argument. I want to answer it, not dodge it.',
  },
] as const;

function CaptureWindow({ version }: { version: string | null }) {
  return (
    <div className="landing-app" aria-hidden="true">
      <div className="landing-app-bar">
        <span className="landing-app-lights">
          <i />
          <i />
          <i />
        </span>
        <span className="landing-app-title">Exalto Capture{version ? ` ${version}` : ''}</span>
        <span className="landing-app-rec">
          <i />
          REC
        </span>
      </div>
      <div className="landing-app-toolbar">
        <span className="is-on">Sessions</span>
        <span>Traces</span>
        <span>Registry</span>
        <span className="landing-app-host">api.anthropic.com · TLS</span>
      </div>
      <div className="landing-app-body">
        {CAPTURE_ROWS.map((row) => (
          <div
            key={row.text}
            className={`landing-app-row${row.who === 'MODEL' ? ' is-model' : ''}`}
          >
            <span className="landing-app-who">{row.who}</span>
            <span className="landing-app-text">{row.text}</span>
            <span className="landing-app-at">{row.at}</span>
          </div>
        ))}
        <div className="landing-app-row is-sealed">
          <span className="landing-app-who">MODEL</span>
          <span className="landing-app-text">
            The strongest objection is timing: a sealed record proves the exchange, not the intent
            behind it.
          </span>
          <span className="landing-app-chip">SEALED ✓ · WITNESSED 14:02 UTC</span>
        </div>
      </div>
      <div className="landing-app-status">
        <span className="landing-app-local">TRACKED LOCALLY</span>
        <span>47 messages · 6 sessions</span>
        <span className="landing-app-signer">signer Seal</span>
      </div>
    </div>
  );
}

function DownloadAction({
  release,
  cliLink = false,
}: {
  release: MacosDownload | null;
  cliLink?: boolean;
}) {
  const size = release ? downloadSize(release.sizeBytes) : '';
  return (
    <div className="landing-download">
      <a
        className="landing-download-button"
        href={release ? release.url : '/docs/getting-started'}
        {...(release ? { download: '' } : {})}
      >
        <svg
          className="landing-download-glyph"
          viewBox="0 0 16 16"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M8 1v9m0 0 3.4-3.4M8 10 4.6 6.6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <path d="M2 12v2.2h12V12" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </svg>
        <b>Download for macOS</b>
      </a>
      {release && (
        <p className="landing-download-meta">
          v{release.version} · Apple silicon{size ? ` · ${size}` : ''}
        </p>
      )}
      {cliLink && (
        <p className="landing-download-alt">
          <a href="#cli">Prefer the command line?</a> <span aria-hidden="true">→</span>
        </p>
      )}
    </div>
  );
}

const STEPS = [
  {
    index: '01',
    label: 'CAPTURE',
    title: 'It records while you work.',
    copy: 'Point Claude Code, Codex, or your own tools at the local service. Every prompt and reply is written to your Mac as it happens, alongside the protocol evidence that fixes it in time.',
  },
  {
    index: '02',
    label: 'SEAL',
    title: 'Seal only what you need.',
    copy: 'Sealing turns a captured session into a portable trace signed by the notary that witnessed it. You choose which lines are disclosed; the rest stay sealed and unreadable.',
  },
  {
    index: '03',
    label: 'VERIFY',
    title: 'Anyone can verify.',
    copy: 'A sealed trace carries its own proof. Hand someone the file or the link and they can check it offline with the verifier, without an account and without asking us.',
  },
] as const;

// Every route here is one the daemon enables by default, and the two coding
// agents are the ones live-tested with their saved logins. Add a tile only when
// the runtime actually supports it.
const CLIENTS = [
  { name: 'Claude Code', note: 'claude.ai login · /anthropic' },
  { name: 'Codex CLI', note: 'ChatGPT login · /codex' },
  { name: 'OpenAI API', note: 'api.openai.com' },
  { name: 'Anthropic API', note: 'api.anthropic.com' },
  { name: 'DeepSeek', note: 'api.deepseek.com' },
  { name: 'OpenRouter', note: 'openrouter.ai' },
] as const;

const BOUNDARY = [
  {
    label: 'ON YOUR MAC',
    title: 'Plaintext and keys stay local.',
    copy: 'The local proxy is the only party that handles your prompts, replies, and provider credentials. They are encrypted at rest on your machine.',
  },
  {
    label: 'THE NOTARY',
    title: 'It witnesses only ciphertext.',
    copy: 'The notary you choose joins the TLS session to the provider and signs what it saw. It never receives your API key, your prompt, or the response.',
  },
  {
    label: 'THE TRACE',
    title: 'One file, verifiable by anyone.',
    copy: 'A sealed .llmtrace carries the disclosed conversation, the provider identity, the digest of every sealed byte, the witnessed time, and the signature.',
  },
] as const;

export function LandingPage({ signedIn = false }: { signedIn?: boolean }) {
  const [release, setRelease] = useState<MacosDownload | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetchLatestMacosDownload().then((next) => {
      if (!cancelled) setRelease(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <main className="landing" id="main">
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero-copy">
          <p className="landing-pill">
            EXALTO CAPTURE · MACOS
            <i className="landing-pill-cursor" aria-hidden="true" />
          </p>
          <h1 id="landing-title">
            Record every session.
            <br />
            Seal what matters.
          </h1>
          <p className="landing-lede">
            Exalto Capture keeps an account of your AI work on your own Mac. When a session needs to
            be more than a memory, seal it into a trace anyone can verify. Nothing readable ever
            leaves your machine.
          </p>
          <DownloadAction release={release} cliLink />
          <p className="landing-hero-note">
            <a href="/docs">Read the docs</a>
            <span aria-hidden="true">·</span>
            <a href={websiteHref('/traces')}>See sealed traces</a>
            <span aria-hidden="true">·</span>
            {signedIn ? <a href="/app/">Open dashboard</a> : <a href="/signin">Sign in</a>}
          </p>
        </div>
        <div className="landing-hero-app">
          <CaptureWindow version={release?.version ?? null} />
          <p className="landing-legend">
            <span>
              <i className="landing-swatch is-you" aria-hidden="true" />
              YOU · TRACKED LOCALLY
            </span>
            <span>
              <i className="landing-swatch is-model" aria-hidden="true" />
              MODEL · SEALED
            </span>
          </p>
        </div>
      </section>

      <section className="landing-section landing-steps" aria-labelledby="steps-title">
        <p className="landing-section-label">
          CAPTURE · SEAL · VERIFY
          <i className="landing-dash" aria-hidden="true" />
        </p>
        <h2 id="steps-title">Three verbs, one record.</h2>
        <div className="landing-step-grid">
          {STEPS.map((step) => (
            <article key={step.index} className="landing-step">
              <div className="landing-step-head">
                <span className="landing-step-index">{step.index}</span>
                <span className="landing-step-label">{step.label}</span>
              </div>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-clients" aria-labelledby="clients-title">
        <p className="landing-section-label">
          WORKS WITH
          <i className="landing-dash" aria-hidden="true" />
        </p>
        <h2 id="clients-title">Point your tools at it.</h2>
        <p className="landing-body">
          Capture runs a local proxy with a fixed URL per provider. Set that as the base URL and
          your coding agent or SDK talks to Capture instead of the provider directly. Saved logins
          keep working; nothing else about your workflow changes.
        </p>
        <ul className="landing-client-grid">
          {CLIENTS.map((client) => (
            <li key={client.name}>
              <b>{client.name}</b>
              <span>{client.note}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="landing-boundary" aria-labelledby="boundary-title">
        <div className="landing-boundary-inner">
          <p className="landing-section-label is-inverse">
            THE TRUST BOUNDARY
            <i className="landing-dash" aria-hidden="true" />
          </p>
          <h2 id="boundary-title">Nothing readable ever leaves your machine.</h2>
          <div className="landing-boundary-grid">
            {BOUNDARY.map((fact) => (
              <article key={fact.label} className="landing-boundary-fact">
                <span className="landing-boundary-label">{fact.label}</span>
                <h3>{fact.title}</h3>
                <p>{fact.copy}</p>
              </article>
            ))}
          </div>
          <p className="landing-doctrine">A trace proves presence, never absence.</p>
        </div>
      </section>

      <section className="landing-section landing-cli" id="cli" aria-labelledby="cli-title">
        <div className="landing-cli-copy">
          <p className="landing-section-label">
            FOR DEVELOPERS
            <i className="landing-dash" aria-hidden="true" />
          </p>
          <h2 id="cli-title">The app is a front for a service you can run yourself.</h2>
          <p className="landing-body">
            The desktop app bundles a local service that also installs on its own, on macOS or
            Linux. Drive it from the command line, seal from your own pipeline, or point it at a
            notary you operate. The trace format and verifier are the contract.
          </p>
          <p className="landing-cli-links">
            <a href="/docs/getting-started">Install the CLI</a>
            <a href="/docs/trace-packages">Trace packages</a>
            <a href="https://github.com/exalto-ai/notary-runtime">Public runtime</a>
          </p>
        </div>
        <div className="landing-terminal">
          <div className="landing-terminal-bar">
            <span>SHELL</span>
            <span>macOS · Linux</span>
          </div>
          <pre>
            <code>
              <span className="is-prompt">$ </span>curl -fsSL https://capture.exalto.ai/install.sh |
              sh{'\n'}
              <span className="is-comment"> installed notaryctl and notaryd</span>
              {'\n\n'}
              <span className="is-prompt">$ </span>notaryd{'\n'}
              <span className="is-comment">
                {' '}
                proxy on 127.0.0.1:8787 · dashboard on 127.0.0.1:8788
              </span>
              {'\n\n'}
              <span className="is-prompt">$ </span>notaryctl traces notarize trc-essay-draft --wait
              {'\n'}
              <span className="is-ok"> sealed ✓ · witnessed 14:02:11 UTC · signer Seal</span>
            </code>
          </pre>
        </div>
      </section>

      <section className="landing-closer" aria-labelledby="closer-title">
        <h2 id="closer-title">Start keeping the record.</h2>
        <p className="landing-body">
          Capture is free to run and yours to keep. An account is only needed when you want a trace
          sealed by Exalto Seal or hosted at a link you can share.
        </p>
        <DownloadAction release={release} />
        <p className="landing-closer-signin">
          {signedIn ? (
            <>
              Signed in already? <a href="/app/">Open your dashboard</a>
            </>
          ) : (
            <>
              Already have an account? <a href="/signin">Sign in</a>
            </>
          )}
        </p>
      </section>
    </main>
  );
}
