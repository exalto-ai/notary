import { useEffect, useState } from 'react';
import { downloadSize, fetchLatestMacosDownload, type MacosDownload } from './release';

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

function DownloadAction({ release }: { release: MacosDownload | null }) {
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
      <p className="landing-download-meta">
        {release
          ? `Apple silicon · version ${release.version}${size ? ` · ${size}` : ''}`
          : 'Apple silicon · free while in beta'}
      </p>
      <p className="landing-download-alt">
        <a href="#build">Build on the Exalto stack</a> <span aria-hidden="true">→</span>
      </p>
    </div>
  );
}

const STEPS = [
  {
    index: '01',
    label: 'CAPTURE',
    title: 'It records while you work.',
    copy: 'Point Claude Code, Codex, or your own tools at the local service. Every prompt and reply is written to your machine as it happens, alongside the protocol evidence that fixes it in time.',
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
    copy: 'A sealed trace carries its own proof. Hand someone the link or the package and they can check it here, or offline with the verifier, without an account and without asking us.',
  },
] as const;

const PROVES = [
  'This exact conversation reached this provider over TLS.',
  'These bytes were witnessed at this time by a named notary.',
  'The disclosed lines are unchanged since they were sealed.',
  'The undisclosed lines existed and were sealed with them.',
] as const;

const CANNOT = [
  'That a model answer is true, complete, or safe.',
  'That a person understood or agreed with what they read.',
  'That nothing else was said outside this record.',
  'That a session you never captured ever happened.',
] as const;

export function LandingPage() {
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
            Seal the ones that matter.
          </h1>
          <p className="landing-lede">
            Exalto Capture keeps an account of your AI work on your own Mac. When a session needs to
            be more than a memory, seal it into a trace anyone can check. Nothing readable ever
            leaves your machine until you say so.
          </p>
          <DownloadAction release={release} />
          <p className="landing-hero-note">
            <a href="/traces">See sealed traces</a>
            <span aria-hidden="true">·</span>
            <a href="/verify">Verify a trace</a>
            <span aria-hidden="true">·</span>
            <a href="/docs">Read the docs</a>
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

      <section className="landing-section landing-receipt-section" aria-labelledby="receipt-title">
        <div className="landing-receipt-copy">
          <p className="landing-section-label">
            THE SEALED TRACE
            <i className="landing-dash" aria-hidden="true" />
          </p>
          <h2 id="receipt-title">The receipt is the evidence.</h2>
          <p className="landing-body">
            A sealed trace is one file. It carries the disclosed conversation, the provider identity
            and TLS evidence, the digest of every sealed byte, the time it was witnessed, and the
            signature of the notary that saw it. Hosting it here is convenient, not required.
          </p>
          <p className="landing-body">
            Exalto Seal is one notary among many. The protocol is the same whether you use ours, a
            third party, or your own.
          </p>
          <p className="landing-receipt-links">
            <a className="landing-secondary-button" href="/traces">
              Browse public traces <span aria-hidden="true">→</span>
            </a>
            <a className="landing-quiet-link" href="/registry">
              See the notary registry <span aria-hidden="true">→</span>
            </a>
          </p>
        </div>
        <figure className="landing-receipt" aria-label="Example sealed trace receipt">
          <div className="landing-receipt-head">
            <span>SEALED TRACE · RECEIPT</span>
            <span className="landing-receipt-state">
              sealed ✓<i aria-hidden="true" />
            </span>
          </div>
          <dl className="landing-receipt-rows">
            <div>
              <dt>trace</dt>
              <dd>essay-draft.llmtrace</dd>
            </div>
            <div>
              <dt>provider</dt>
              <dd className="is-blue">api.anthropic.com · TLS ✓</dd>
            </div>
            <div>
              <dt>messages</dt>
              <dd>47</dd>
            </div>
            <div>
              <dt>sessions</dt>
              <dd>6 · all sealed</dd>
            </div>
            <div>
              <dt>sha-256</dt>
              <dd>9f2c 71e0 ···· d3a4 1b8c</dd>
            </div>
            <div>
              <dt>witnessed</dt>
              <dd>2026-08-24 14:02:11 UTC</dd>
            </div>
            <div>
              <dt>signer</dt>
              <dd>Seal</dd>
            </div>
          </dl>
          <p className="landing-receipt-verified">
            <span className="landing-receipt-check" aria-hidden="true">
              ✓
            </span>
            Verified with the public verifier
          </p>
          <p className="landing-receipt-sub">offline · no account · anyone can run</p>
        </figure>
      </section>

      <section className="landing-section landing-trust" aria-labelledby="trust-title">
        <p className="landing-section-label">
          WHAT A TRACE IS WORTH
          <i className="landing-dash" aria-hidden="true" />
        </p>
        <h2 id="trust-title">Claim exactly what the evidence supports.</h2>
        <div className="landing-trust-grid">
          <div className="landing-trust-list">
            <p className="landing-trust-heading">What a trace proves</p>
            <ul>
              {PROVES.map((item) => (
                <li key={item}>
                  <i className="landing-mark is-yes" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="landing-trust-list">
            <p className="landing-trust-heading">What it cannot</p>
            <ul>
              {CANNOT.map((item) => (
                <li key={item}>
                  <i className="landing-mark is-no" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="landing-doctrine">A trace proves presence, never absence.</p>
      </section>

      <section className="landing-build" id="build" aria-labelledby="build-title">
        <div className="landing-build-inner">
          <div className="landing-build-copy">
            <p className="landing-section-label is-inverse">
              FOR DEVELOPERS
              <i className="landing-dash" aria-hidden="true" />
            </p>
            <h2 id="build-title">Build on the Exalto stack.</h2>
            <p className="landing-body is-inverse">
              The desktop app bundles a local service you can also run yourself. Drive it from the
              command line, seal from your own pipeline, or point it at a notary you operate. The
              trace format and verifier are the contract.
            </p>
            <p className="landing-build-links">
              <a href="/docs">Read the docs</a>
              <a href="/docs/trace-packages">Trace packages</a>
              <a href="/registry">Notary registry</a>
              <a href="/signin">Get an API key</a>
            </p>
          </div>
          <div className="landing-terminal">
            <div className="landing-terminal-bar">
              <span>SHELL</span>
              <span>macOS · Linux</span>
            </div>
            <pre>
              <code>
                <span className="is-prompt">$ </span>curl -fsSL https://seal.exalto.ai/install.sh |
                sh{'\n'}
                <span className="is-comment"> installed notaryctl and notaryd</span>
                {'\n\n'}
                <span className="is-prompt">$ </span>notaryd{'\n'}
                <span className="is-comment"> listening on 127.0.0.1:7878</span>
                {'\n\n'}
                <span className="is-prompt">$ </span>notaryctl trace seal essay-draft{'\n'}
                <span className="is-ok"> sealed ✓ witnessed 14:02:11 UTC · signer Seal</span>
              </code>
            </pre>
          </div>
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
          Already have an account? <a href="/signin">Sign in</a>
        </p>
      </section>
    </main>
  );
}
