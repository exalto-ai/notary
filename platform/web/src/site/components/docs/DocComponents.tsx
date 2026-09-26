import { Anchor, Box, Button, CopyButton, Text, UnstyledButton } from '@mantine/core';
import { IconArrowDown, IconCheck, IconCopy } from '@tabler/icons-react';
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
import { downloadSize, fetchLatestMacosDownload, type MacosDownload } from '../../release';

function nodeText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return nodeText(node.props.children);
  return '';
}

function Heading2({ className, ...props }: ComponentPropsWithoutRef<'h2'>) {
  return <h2 {...props} className={['x-mdx-h2', className].filter(Boolean).join(' ')} />;
}

function Heading3({ className, ...props }: ComponentPropsWithoutRef<'h3'>) {
  return <h3 {...props} className={['x-mdx-h3', className].filter(Boolean).join(' ')} />;
}

function Paragraph({ className, ...props }: ComponentPropsWithoutRef<'p'>) {
  return <p {...props} className={['x-mdx-p', className].filter(Boolean).join(' ')} />;
}

function DocLink({ href = '', ...props }: ComponentPropsWithoutRef<'a'>) {
  const external = /^https?:\/\//.test(href);
  return (
    <Anchor
      {...props}
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
    />
  );
}

function CodeBlock({ children, className, ...props }: ComponentPropsWithoutRef<'pre'>) {
  const value = nodeText(children).replace(/\n$/, '');
  return (
    <Box className="x-mdx-code">
      <CopyButton value={value}>
        {({ copied, copy }) => (
          <UnstyledButton
            className="x-mdx-copy"
            onClick={copy}
            aria-label={copied ? 'Copied code' : 'Copy code'}
          >
            {copied ? <IconCheck size={13} stroke={1.8} /> : <IconCopy size={13} stroke={1.8} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </UnstyledButton>
        )}
      </CopyButton>
      <pre {...props} className={className}>
        {children}
      </pre>
    </Box>
  );
}

function Table({ className, ...props }: ComponentPropsWithoutRef<'table'>) {
  return (
    <Box className="x-mdx-table-wrap">
      <table {...props} className={className} />
    </Box>
  );
}

export function Cards({ children }: { children: ReactNode }) {
  return <Box className="x-doc-cards">{children}</Box>;
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
    <Box className="x-doc-card">
      <Text className="x-data" c="var(--x-faint)">
        {eyebrow}
      </Text>
      <Text component="h3" fz={16} fw={610} mt={8} mb={0}>
        {title}
      </Text>
      <Box c="var(--x-quiet)" mt={7} className="x-doc-card-copy">
        {children}
      </Box>
    </Box>
  );
}

export function Steps({ children }: { children: ReactNode }) {
  return <ol className="x-doc-steps">{children}</ol>;
}

export function Step({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li>
      <Box>
        <Text fw={610}>{title}</Text>
        <Box c="var(--x-quiet)" mt={3}>
          {children}
        </Box>
      </Box>
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
    <aside className="x-doc-callout" data-tone={tone}>
      {title ? (
        <Text fw={610} fz="sm" mb={4}>
          {title}
        </Text>
      ) : null}
      <Box>{children}</Box>
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
    <Box className="x-doc-download">
      <Box>
        <Text className="x-data" c="var(--x-faint)">
          SIGNED DESKTOP APP
        </Text>
        <Text fw={610} fz={17} mt={5}>
          Exalto Capture for Apple silicon
        </Text>
        <Text c="var(--x-quiet)" fz="sm" mt={4}>
          macOS 12 Monterey or later · bundled local service
        </Text>
      </Box>
      <Box className="x-doc-download-action">
        {release ? (
          <Button
            component="a"
            href={release.url}
            leftSection={<IconArrowDown size={16} stroke={1.8} />}
          >
            Download {release.version}
          </Button>
        ) : release === null ? (
          <Button component="a" href="/" variant="default">
            View downloads
          </Button>
        ) : (
          <Button disabled loading>
            Checking release
          </Button>
        )}
        <Text className="x-data" c="var(--x-faint)" ta="right" mt={7}>
          {release ? `${downloadSize(release.sizeBytes)} · DMG` : 'Latest stable release'}
        </Text>
      </Box>
    </Box>
  );
}

type ProviderProps = {
  name: string;
  auth: string;
  children: ReactNode;
};

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
    <Box className="x-provider-tabs">
      <Box className="x-provider-tablist" role="tablist" aria-label="Provider setup">
        {providers.map((provider, index) => (
          <UnstyledButton
            key={provider.props.name}
            id={`${id}-tab-${index}`}
            role="tab"
            aria-selected={index === active}
            aria-controls={`${id}-panel`}
            tabIndex={index === active ? 0 : -1}
            data-active={index === active || undefined}
            onClick={() => setActive(index)}
            onKeyDown={(event) => move(event, index)}
          >
            <span>{provider.props.name}</span>
            <small>{provider.props.auth}</small>
          </UnstyledButton>
        ))}
      </Box>
      <Box
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-tab-${active}`}
        className="x-provider-panel"
      >
        {selected.props.children}
      </Box>
    </Box>
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
    <Box className="x-trace-anatomy" data-state={state}>
      <Box className="x-anatomy-head">
        <Box>
          <Text className="x-data" c="var(--x-faint)">
            TRACE ANATOMY
          </Text>
          <Text fw={620} fz={18} mt={4}>
            What changes when a Trace is sealed?
          </Text>
        </Box>
        <Box className="x-anatomy-switch" role="group" aria-label="Trace evidence state">
          {(Object.keys(anatomy) as Array<keyof typeof anatomy>).map((value) => (
            <UnstyledButton
              key={value}
              data-active={state === value || undefined}
              aria-pressed={state === value}
              onClick={() => setState(value)}
            >
              {anatomy[value].label}
            </UnstyledButton>
          ))}
        </Box>
      </Box>

      <Box className="x-anatomy-path" aria-label={`${current.label} evidence path`}>
        {current.path.map((node, index) => (
          <Box key={node} className="x-anatomy-node">
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{node}</strong>
          </Box>
        ))}
      </Box>

      <Text c="var(--x-quiet)" fz="sm" maw="62ch" mt="md">
        {current.description}
      </Text>

      <Box className="x-anatomy-layers" role="tabpanel" aria-live="polite">
        {current.layers.map(([name, status, description]) => (
          <Box key={name} className="x-anatomy-layer">
            <Text className="x-data" fw={560}>
              {name}
            </Text>
            <Text className="x-anatomy-status" data-status={status.toLowerCase()}>
              {status}
            </Text>
            <Text fz="sm" c="var(--x-quiet)">
              {description}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export const mdxComponents = {
  h2: Heading2,
  h3: Heading3,
  p: Paragraph,
  a: DocLink,
  pre: CodeBlock,
  table: Table,
  Cards,
  Card,
  Steps,
  Step,
  Callout,
  DownloadCard,
  ProviderTabs,
  Provider,
  TraceAnatomy,
} satisfies MDXComponents;
