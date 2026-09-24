import { ChevronDown } from 'lucide-react';
import type { MouseEventHandler, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  type DocBlock,
  type DocOutlineItem,
  type DocPage,
  type DocPageKey,
  docAliases,
  docNavigation,
  docPages,
  docSubheadings,
  isDocPageKey,
  legalNotice,
} from '../content/docs';
import { navigateTo } from './navigation';
import { downloadSize, fetchLatestMacosDownload, type MacosDownload } from './release';

const docOrder = docNavigation.flatMap((group) => group.pages.map(([key]) => key));

function docHref(key: DocPageKey, section?: string) {
  const route = key === 'overview' ? '/docs' : `/docs/${key}`;
  return section ? `${route}?section=${encodeURIComponent(section)}` : route;
}

function docSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function docHeadingLevel(pageKey: DocPageKey, block: DocBlock) {
  return docSubheadings[pageKey]?.has(block.heading) ? 3 : 2;
}

function getDocOutline(pageKey: DocPageKey, blocks: DocBlock[]) {
  return blocks.reduce<DocOutlineItem[]>((items, block) => {
    if (docHeadingLevel(pageKey, block) === 3 && items.length) {
      items.at(-1)?.children.push(block);
    } else {
      items.push({ block, children: [] });
    }
    return items;
  }, []);
}

function getBlockText(block: DocBlock) {
  return [
    block.heading,
    block.body,
    block.code,
    block.note,
    ...(block.items || []),
    ...(block.steps || []).flatMap((step) => [step.title, step.body]),
    ...(block.cards || []).flatMap((card) => [card.meta, card.title, card.body]),
    ...(block.definitions || []).flatMap((item) => [item.term, item.description]),
  ]
    .filter(Boolean)
    .join(' ');
}

function copyToClipboard(value: string) {
  return navigator.clipboard?.writeText(value).catch(() => {});
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10.6 13.4a4 4 0 0 0 5.7.1l2-2a4 4 0 0 0-5.7-5.7l-1.1 1.1M13.4 10.6a4 4 0 0 0-5.7-.1l-2 2a4 4 0 0 0 5.7 5.7l1.1-1.1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 12 4.2 4.2L19 6.5" />
    </svg>
  );
}

function DocsInlineText({ children }: { children: ReactNode }) {
  return String(children)
    .split('`')
    .map((part, index) =>
      index % 2 ? (
        <code className="docs-inline-code" key={`${part}-${index}`}>
          {part}
        </code>
      ) : (
        part
      ),
    );
}

function MacosDownloadLink() {
  const [download, setDownload] = useState<MacosDownload | null>();
  useEffect(() => {
    let active = true;
    fetchLatestMacosDownload().then((result) => {
      if (active) setDownload(result);
    });
    return () => {
      active = false;
    };
  }, []);

  if (download === undefined) return <p role="status">Loading macOS download…</p>;
  if (!download) {
    return (
      <p role="status">
        Download information is temporarily unavailable.{' '}
        <a href="https://github.com/exalto-ai/notary-runtime/releases">View published releases</a>.
      </p>
    );
  }
  const size = downloadSize(download.sizeBytes);
  return (
    <div className="docs-download">
      <a className="app-primary-action" href={download.url}>
        Download for macOS
      </a>
      <span>
        v{download.version} · Apple silicon{size ? ` · ${size}` : ''}
      </span>
    </div>
  );
}

function DocsBlock({ block, pageKey }: { block: DocBlock; pageKey: DocPageKey }) {
  const Heading = docHeadingLevel(pageKey, block) === 3 ? 'h3' : 'h2';
  const slug = docSlug(block.heading);
  const code = block.code;
  const headingLink = `${window.location.origin}${docHref(pageKey, slug)}`;
  const [copied, setCopied] = useState(false);
  const copy = (value: string) => {
    copyToClipboard(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };
  return (
    <section
      id={slug}
      className={`docs-section docs-section--level-${docHeadingLevel(pageKey, block)}`}
    >
      <div className="docs-heading-row">
        <Heading>{block.heading}</Heading>
        <button
          type="button"
          className="docs-copy-button docs-anchor"
          onClick={() => copy(headingLink)}
          aria-label={`${copied ? 'Copied link to' : 'Copy link to'} ${block.heading}`}
          title={copied ? 'Copied' : 'Copy link'}
        >
          {copied ? <CheckIcon /> : <LinkIcon />}
        </button>
      </div>
      {block.body && (
        <p>
          <DocsInlineText>{block.body}</DocsInlineText>
        </p>
      )}
      {block.macosDownload && <MacosDownloadLink />}
      {code && (
        <div className="docs-code">
          <button
            type="button"
            className="docs-copy-button"
            onClick={() => copy(code)}
            aria-label={`Copy code for ${block.heading}`}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
          <pre>
            <code>{code}</code>
          </pre>
        </div>
      )}
      {block.note && (
        <aside className="docs-note">
          <DocsInlineText>{block.note}</DocsInlineText>
        </aside>
      )}
      {block.items && (
        <ul className="docs-list">
          {block.items.map((item) => (
            <li key={item}>
              <DocsInlineText>{item}</DocsInlineText>
            </li>
          ))}
        </ul>
      )}
      {block.steps && (
        <ol className="docs-flow">
          {block.steps.map((step, index) => (
            <li key={step.title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <b>{step.title}</b>
                <p>
                  <DocsInlineText>{step.body}</DocsInlineText>
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
      {block.cards && (
        <div className="docs-card-grid">
          {block.cards.map((card) => (
            <article key={`${card.meta}-${card.title}`}>
              <span>{card.meta}</span>
              <h3>{card.title}</h3>
              <p>
                <DocsInlineText>{card.body}</DocsInlineText>
              </p>
            </article>
          ))}
        </div>
      )}
      {block.columns && (
        <div className="docs-boundary-grid">
          {block.columns.map((column) => (
            <article key={column.title}>
              <h3>{column.title}</h3>
              <ul>
                {column.items.map((item) => (
                  <li key={item}>
                    <DocsInlineText>{item}</DocsInlineText>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
      {block.definitions && (
        <dl className="docs-definitions">
          {block.definitions.map((item) => (
            <div key={item.term}>
              <dt>{item.term}</dt>
              <dd>
                <DocsInlineText>{item.description}</DocsInlineText>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

function DocsOutline({
  page,
  pageKey,
  section,
  onNavigate,
}: {
  page: DocPage;
  pageKey: DocPageKey;
  section?: string;
  onNavigate?: MouseEventHandler<HTMLAnchorElement>;
}) {
  const linkFor = (block: DocBlock) => docHref(pageKey, docSlug(block.heading));
  return (
    <ol className="docs-toc-list">
      {getDocOutline(pageKey, page.blocks).map(({ block, children }) => (
        <li key={block.heading}>
          <a
            className={section === docSlug(block.heading) ? 'active' : ''}
            href={linkFor(block)}
            onClick={onNavigate}
            aria-current={section === docSlug(block.heading) ? 'location' : undefined}
          >
            {block.heading}
          </a>
          {children.length > 0 && (
            <ol>
              {children.map((child) => (
                <li key={child.heading}>
                  <a
                    className={section === docSlug(child.heading) ? 'active' : ''}
                    href={linkFor(child)}
                    onClick={onNavigate}
                    aria-current={section === docSlug(child.heading) ? 'location' : undefined}
                  >
                    {child.heading}
                  </a>
                </li>
              ))}
            </ol>
          )}
        </li>
      ))}
    </ol>
  );
}

function DocsSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const entries = useMemo(
    () =>
      Object.keys(docPages)
        .filter(isDocPageKey)
        .map((key) => {
          const page = docPages[key];
          return {
            key,
            title: page.title,
            lead: page.lead,
            blocks: page.blocks,
            text: `${page.title} ${page.lead} ${page.blocks.map(getBlockText).join(' ')}`.toLowerCase(),
          };
        }),
    [],
  );
  const results = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return entries.slice(0, 7);
    return entries.filter((entry) => terms.every((term) => entry.text.includes(term))).slice(0, 10);
  }, [entries, query]);
  useEffect(() => {
    if (open) setQuery('');
  }, [open]);
  const choose = (result: { key: DocPageKey }) => {
    navigateTo(docHref(result.key));
    onClose();
  };
  return (
    <CommandDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      title="Search documentation"
      description="Search setup, captures, providers, and sharing."
      className="docs-command-dialog"
    >
      <Command shouldFilter={false} className="docs-command">
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Search setup, captures, providers…"
        />
        <CommandList>
          <CommandEmpty>No documentation matches “{query}”.</CommandEmpty>
          {results.map((result) => (
            <CommandItem value={result.key} onSelect={() => choose(result)} key={result.key}>
              <span className="docs-command-copy">
                <b>{result.title}</b>
                <small>{result.lead}</small>
              </span>
            </CommandItem>
          ))}
        </CommandList>
        <div className="docs-command-footer">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </Command>
    </CommandDialog>
  );
}

function DocsMobileToolbar({
  currentKey,
  page,
  section,
  onSearch,
}: {
  currentKey: DocPageKey;
  page: DocPage;
  section?: string;
  onSearch: () => void;
}) {
  const [panel, setPanel] = useState<'docs' | 'toc' | null>(null);
  const toolbarRef = useRef<HTMLElement>(null);
  const currentLabel =
    docNavigation.flatMap((group) => group.pages).find(([key]) => key === currentKey)?.[1] ||
    page.title;
  useEffect(() => setPanel(null), [currentKey, section]);
  useEffect(() => {
    const close = (event: MouseEvent | KeyboardEvent) => {
      const escapePressed = event instanceof KeyboardEvent && event.key === 'Escape';
      const outsideClick =
        event instanceof MouseEvent &&
        event.target instanceof Node &&
        !toolbarRef.current?.contains(event.target);
      if (escapePressed || outsideClick) setPanel(null);
    };
    document.addEventListener('mousedown', close);
    window.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', close);
    };
  }, []);
  const toggle = (nextPanel: 'docs' | 'toc') =>
    setPanel((current) => (current === nextPanel ? null : nextPanel));
  return (
    <nav className="docs-mobile-toolbar" aria-label="Documentation navigation" ref={toolbarRef}>
      <button
        type="button"
        className="docs-search-trigger"
        onClick={() => {
          setPanel(null);
          onSearch();
        }}
      >
        Search documentation <kbd>⌘ K</kbd>
      </button>
      <div className="docs-mobile-toolbar-row">
        <button
          type="button"
          className={panel === 'docs' ? 'active' : ''}
          onClick={() => toggle('docs')}
          aria-expanded={panel === 'docs'}
          aria-controls="docs-mobile-panel"
        >
          <span>
            <small>Docs</small>
            {currentLabel}
          </span>
          <ChevronDown aria-hidden="true" />
        </button>
        <button
          type="button"
          className={panel === 'toc' ? 'active' : ''}
          onClick={() => toggle('toc')}
          aria-expanded={panel === 'toc'}
          aria-controls="docs-mobile-panel"
        >
          <span>
            <small>Page</small>On this page
          </span>
          <ChevronDown aria-hidden="true" />
        </button>
      </div>
      {panel && (
        <div className="docs-mobile-panel" id="docs-mobile-panel">
          {panel === 'docs' ? (
            docNavigation.map((group) => (
              <div className="docs-mobile-nav-group" key={group.label}>
                <span>{group.label}</span>
                {group.pages.map(([key, label]) => (
                  <a
                    className={currentKey === key ? 'active' : ''}
                    href={docHref(key)}
                    aria-current={currentKey === key ? 'page' : undefined}
                    onClick={() => setPanel(null)}
                    key={key}
                  >
                    {label}
                  </a>
                ))}
              </div>
            ))
          ) : (
            <div className="docs-mobile-toc">
              <span>{page.title}</span>
              <DocsOutline
                page={page}
                pageKey={currentKey}
                section={section}
                onNavigate={() => setPanel(null)}
              />
            </div>
          )}
        </div>
      )}
    </nav>
  );
}

export function Docs({ pageKey, section }: { pageKey: string; section?: string }) {
  const currentKey = isDocPageKey(pageKey) ? pageKey : docAliases[pageKey] || 'overview';
  const page = docPages[currentKey];
  const currentIndex = docOrder.indexOf(currentKey);
  const previousKey = docOrder[currentIndex - 1];
  const nextKey = docOrder[currentIndex + 1];
  const next = nextKey ? { href: docHref(nextKey), label: docPages[nextKey].title } : null;
  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => {
    window.requestAnimationFrame(() => {
      if (section) document.getElementById(section)?.scrollIntoView({ block: 'start' });
      else window.scrollTo({ top: 0, behavior: 'instant' });
    });
  }, [currentKey, section]);
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === 'Escape') setSearchOpen(false);
      if (event.altKey && event.key === 'ArrowLeft' && previousKey)
        navigateTo(docHref(previousKey));
      if (event.altKey && event.key === 'ArrowRight' && nextKey) navigateTo(docHref(nextKey));
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [nextKey, previousKey]);
  return (
    <>
      <DocsMobileToolbar
        currentKey={currentKey}
        page={page}
        section={section}
        onSearch={() => setSearchOpen(true)}
      />
      <main className="docs-shell">
        <aside className="docs-sidebar">
          <button type="button" className="docs-search-trigger" onClick={() => setSearchOpen(true)}>
            Search <kbd>⌘ K</kbd>
          </button>
          {docNavigation.map((group) => (
            <div className="docs-nav-group" key={group.label}>
              <span className="docs-group">{group.label}</span>
              {group.pages.map(([key, label]) => (
                <a
                  className={currentKey === key ? 'active' : ''}
                  href={docHref(key)}
                  aria-current={currentKey === key ? 'page' : undefined}
                  key={key}
                >
                  {label}
                </a>
              ))}
            </div>
          ))}
        </aside>
        <article className="docs-content">
          <h1>{page.title}</h1>
          <p className="docs-lead">{page.lead}</p>
          {page.blocks.map((block) => (
            <DocsBlock block={block} pageKey={currentKey} key={block.heading} />
          ))}
          <div className="docs-page-nav">
            {previousKey ? (
              <a href={docHref(previousKey)}>
                <span>Previous</span>
                {docPages[previousKey].title}
              </a>
            ) : (
              <span />
            )}
            {next && (
              <a href={next.href}>
                <span>Next</span>
                {next.label}
              </a>
            )}
          </div>
          <p className="docs-legal-notice">{legalNotice}</p>
        </article>
        <aside className="docs-toc" aria-label="On this page">
          <span>On this page</span>
          <DocsOutline page={page} pageKey={currentKey} section={section} />
          <p>
            <kbd>⌥</kbd> <kbd>←</kbd>
            <kbd>→</kbd> pages
          </p>
        </aside>
      </main>
      <DocsSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
