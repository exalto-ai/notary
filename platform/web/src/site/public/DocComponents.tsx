import type { MDXComponents } from 'mdx/types';
import {
  Children,
  type ComponentPropsWithoutRef,
  isValidElement,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  useEffect,
  useId,
  useState,
} from 'react';
import { downloadSize, fetchLatestMacosDownload, type MacosDownload } from '../release';
import { href } from '../router';
import { DownloadIcon } from './figures';
import { useCopied } from './hooks';

function nodeText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return nodeText(node.props.children);
  return '';
}

function DocLink({ href: target = '', ...props }: ComponentPropsWithoutRef<'a'>) {
  const external = /^https?:\/\//.test(target);
  return (
    <a
      {...props}
      href={external ? target : href(target)}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
    />
  );
}

function CodeBlock({ children, ...props }: ComponentPropsWithoutRef<'pre'>) {
  const value = nodeText(children).replace(/\n$/, '');
  const [copied, copy] = useCopied();
  return (
    <div className="cp-mdx-code">
      <pre {...props}>{children}</pre>
      <button
        type="button"
        className="cp-mdx-copy"
        onClick={() => copy('code', value)}
        aria-label={copied ? 'Copied code' : 'Copy code'}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

function Table(props: ComponentPropsWithoutRef<'table'>) {
  return (
    <div className="cp-mdx-table">
      <table {...props} />
    </div>
  );
}

export function Cards({ children }: { children: ReactNode }) {
  return <div className="cp-cells cp-doc-cards">{children}</div>;
}

export function Card({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="cp-doc-card">
      <div className="cp-micro">{eyebrow}</div>
      <h3>{title}</h3>
      <div className="cp-doc-card-copy">{children}</div>
    </div>
  );
}

export function Columns({ children }: { children: ReactNode }) {
  return <div className="cp-cells cp-doc-columns">{children}</div>;
}

export function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="cp-doc-column">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

export function Steps({ children }: { children: ReactNode }) {
  return <ol className="cp-doc-steps">{children}</ol>;
}

export function Step({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li>
      <span aria-hidden="true" />
      <div>
        <h3>{title}</h3>
        <div className="cp-doc-step-body">{children}</div>
      </div>
    </li>
  );
}

export function Callout({
  title,
  tone = 'seal',
  children,
}: {
  title?: string;
  tone?: 'seal' | 'local' | 'alert';
  children: ReactNode;
}) {
  return (
    <aside className="cp-callout">
      {title ? (
        <div className="cp-box-head" data-tone={tone}>
          {title}
        </div>
      ) : null}
      <div className="cp-callout-body">{children}</div>
    </aside>
  );
}

export function DownloadCard() {
  const [release, setRelease] = useState<MacosDownload | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    fetchLatestMacosDownload().then((value) => {
      if (!cancelled) setRelease(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="cp-doc-download">
      <div>
        <div className="cp-micro">Signed desktop app</div>
        <h3>Exalto Capture for Apple silicon</h3>
        <p>macOS 12 Monterey or later · bundled local service</p>
      </div>
      <div className="cp-doc-download-action">
        {release ? (
          <a href={release.url} className="cp-btn-primary">
            Download {release.version}
            <DownloadIcon />
          </a>
        ) : release === null ? (
          <a href={href('/#quickstart')} className="cp-btn-secondary">
            Install the CLI instead
          </a>
        ) : (
          <span className="cp-btn-primary" aria-disabled="true">
            Checking release
          </span>
        )}
        <span className="cp-hero-note">
          {release ? `${downloadSize(release.sizeBytes)} · DMG` : 'Latest stable release'}
        </span>
      </div>
    </div>
  );
}

type ProviderProps = { name: string; auth: string; children: ReactNode };

export function Provider(_props: ProviderProps) {
  return null;
}

export function ProviderTabs({ children }: { children: ReactNode }) {
  const providers = Children.toArray(children).filter(
    (child): child is ReactElement<ProviderProps> => isValidElement<ProviderProps>(child),
  );
  const [active, setActive] = useState(0);
  const id = useId();
  const selected = providers[active] ?? providers[0];

  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % providers.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + providers.length) % providers.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = providers.length - 1;
    else return;
    event.preventDefault();
    setActive(next);
    document.getElementById(`${id}-tab-${next}`)?.focus();
  };

  if (!selected) return null;

  return (
    <div className="cp-provider-tabs">
      <div className="cp-provider-tablist" role="tablist" aria-label="Provider setup">
        {providers.map((provider, index) => (
          <button
            type="button"
            key={provider.props.name}
            id={`${id}-tab-${index}`}
            role="tab"
            aria-selected={index === active}
            aria-controls={`${id}-panel`}
            tabIndex={index === active ? 0 : -1}
            onClick={() => setActive(index)}
            onKeyDown={(event) => move(event, index)}
          >
            <span>{provider.props.name}</span>
            <small>{provider.props.auth}</small>
          </button>
        ))}
      </div>
      <div
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-tab-${active}`}
        className="cp-provider-panel"
      >
        {selected.props.children}
      </div>
    </div>
  );
}

const anatomy = {
  captured: {
    label: 'Captured',
    description:
      'Private retry state on this device. Nothing here is independently verifiable yet.',
    path: ['Provider interaction', 'Local encrypted capture', 'Ready to seal'],
    layers: [
      [
        'capture.llmcapture',
        'Private',
        'Vault-encrypted request, response, and deferred TLS state',
      ],
      ['Authenticated HTTP', 'Pending', 'Created only when this Trace is sealed'],
      ['trace.otlp.json', 'Pending', 'No portable OpenTelemetry evidence yet'],
      ['Portable package', 'None', 'The Trace remains local and unshared'],
    ],
  },
  sealed: {
    label: 'Sealed',
    description:
      'Portable evidence whose disclosed bytes and derived trace can be verified offline.',
    path: ['Encrypted capture', 'Compatible notary', 'Verifiable .llmtrace'],
    layers: [
      ['evidence.tlsn', 'Signed', 'Notary signature and authenticated provider TLS session'],
      [
        'disclosed HTTP',
        'Authenticated',
        'Bodies are disclosed; header values are hidden by default',
      ],
      ['trace.otlp.json', 'Derived', 'Deterministic GenAI mapping of authenticated bytes'],
      ['archive-manifest.json', 'Bound', 'Ordered sizes and hashes bind the package together'],
    ],
  },
} as const;

export function TraceAnatomy() {
  const [state, setState] = useState<keyof typeof anatomy>('captured');
  const current = anatomy[state];
  return (
    <div className="cp-anatomy cp-paper" data-state={state}>
      <div className="cp-anatomy-head">
        <div>
          <div className="cp-micro">Trace anatomy</div>
          <h3>What changes when a Trace is sealed?</h3>
        </div>
        <div className="cp-anatomy-switch" role="group" aria-label="Trace evidence state">
          {(Object.keys(anatomy) as Array<keyof typeof anatomy>).map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={state === value}
              onClick={() => setState(value)}
            >
              {anatomy[value].label}
            </button>
          ))}
        </div>
      </div>
      <div className="cp-anatomy-path" role="list" aria-label={`${current.label} evidence path`}>
        {current.path.map((node, index) => (
          <div key={node} className="cp-anatomy-node" role="listitem">
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{node}</strong>
          </div>
        ))}
      </div>
      <p className="cp-anatomy-description">{current.description}</p>
      <div className="cp-anatomy-layers" aria-live="polite">
        {current.layers.map(([name, status, description]) => (
          <div key={name} className="cp-anatomy-layer">
            <code>{name}</code>
            <span className="cp-anatomy-status" data-status={status.toLowerCase()}>
              {status}
            </span>
            <p>{description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export const mdxComponents = {
  a: DocLink,
  pre: CodeBlock,
  table: Table,
  Cards,
  Card,
  Columns,
  Column,
  Steps,
  Step,
  Callout,
  DownloadCard,
  ProviderTabs,
  Provider,
  TraceAnatomy,
} satisfies MDXComponents;
