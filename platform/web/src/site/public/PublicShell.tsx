import type { ReactNode } from 'react';
import { href } from '../router';

/** The Exalto Capture mark: viewfinder brackets around a record lens. */
export function CaptureMark({ size = 34, stroke = 4 }: { size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="-46 -46 92 92" aria-hidden="true">
      <g
        style={{
          stroke: 'currentColor',
          strokeWidth: stroke,
          strokeLinecap: 'round',
          fill: 'none',
        }}
      >
        <path d="M-34,-16 L-34,-30 A4,4 0 0 1 -30,-34 L-16,-34" />
        <path d="M16,-34 L30,-34 A4,4 0 0 1 34,-30 L34,-16" />
        <path d="M34,16 L34,30 A4,4 0 0 1 30,34 L16,34" />
        <path d="M-16,34 L-30,34 A4,4 0 0 1 -34,30 L-34,16" />
      </g>
      <circle r="15" style={{ fill: 'none', stroke: 'currentColor', strokeWidth: stroke }} />
      <circle r="6.5" style={{ fill: 'currentColor' }} />
    </svg>
  );
}

export const proofOrigin = 'https://proof.exalto.ai/';
export const sealOrigin = 'https://seal.exalto.ai';
export const runtimeRepo = 'https://github.com/exalto-ai/notary-runtime';

const navLinks: Array<[string, string]> = [
  ['App', '/#app'],
  ['SDK', '/#sdk'],
  ['Protocol', '/#protocol'],
  ['Seal', '/#seal'],
  ['Docs', '/docs'],
];

export type SessionState = 'pending' | 'signed-in' | 'signed-out';

export function PublicHeader({
  session = 'signed-out',
  current,
}: {
  session?: SessionState;
  current?: 'docs';
}) {
  return (
    <header className="cp-header" data-md="skip">
      <a href={href('/')} className="cp-brand" aria-label="Exalto Capture home">
        <CaptureMark size={34} stroke={4} />
        <span>Exalto Capture</span>
      </a>
      <nav className="cp-nav" aria-label="Primary">
        {navLinks.map(([label, path]) => (
          <a
            key={label}
            href={href(path)}
            aria-current={label === 'Docs' && current === 'docs' ? 'page' : undefined}
          >
            {label}
          </a>
        ))}
        <a href={proofOrigin} className="cp-nav-sibling">
          Proof of Thought ↗
        </a>
        {session === 'pending' ? (
          // The control is about to be here either way; the wait keeps its
          // footprint so the bar does not shift when the session answers.
          <span className="cp-nav-account" aria-hidden="true" style={{ visibility: 'hidden' }}>
            Account
          </span>
        ) : (
          <a
            href={href(session === 'signed-in' ? '/app/overview' : '/signin')}
            className="cp-nav-account"
          >
            {session === 'signed-in' ? 'Account' : 'Sign in'}
          </a>
        )}
      </nav>
    </header>
  );
}

export const legalNotice =
  'Exalto Seal is not a notary public. Sealing is not a notarial act. A receipt is cryptographic evidence, not a legal instrument. The ECP specification uses "notary" as a technical role term, in the way public-key infrastructure uses "certificate authority."';

export function PublicFooter() {
  return (
    <footer className="cp-footer">
      <p className="cp-footer-note">
        Exalto Seal is not a notary public. Sealing is not a notarial act. A receipt is
        cryptographic evidence, not a legal instrument. The ECP specification uses “notary” as a
        technical role term, in the way public-key infrastructure uses “certificate authority.”
        Built on TLSNotary.
      </p>
      <nav className="cp-footer-nav" aria-label="Footer" data-md="skip">
        <span className="cp-footer-brand">
          <CaptureMark size={20} stroke={5} />
          Exalto Capture · Exalto
        </span>
        <a href={href('/docs')}>Spec</a>
        <a href={runtimeRepo}>GitHub</a>
        <a href={`${sealOrigin}/registry`}>Registry</a>
        <a href={`${sealOrigin}/traces`}>Traces</a>
        <a href={`${sealOrigin}/verify`}>Verify a trace</a>
        <a href={href('/privacy')}>Privacy</a>
        <a href={href('/terms')}>Terms</a>
      </nav>
    </footer>
  );
}

/**
 * The public ground: the tokens and the grid paper. App.tsx marks the document
 * (`html.cp-root`) so the body behind it is graphite too.
 */
export function PublicLayout({
  children,
  session = 'signed-out',
  current,
}: {
  children: ReactNode;
  session?: SessionState;
  current?: 'docs';
}) {
  return (
    <div className="cp">
      <PublicHeader session={session} current={current} />
      {children}
      <PublicFooter />
    </div>
  );
}

export function PublicNotFound({ path }: { path: string }) {
  return (
    <main className="cp-notfound">
      <h1>That page is not here.</h1>
      <p>
        Nothing answers to <code>{path}</code>.
      </p>
      <a href={href('/')} className="cp-ulink">
        → Back to Exalto Capture
      </a>
    </main>
  );
}
