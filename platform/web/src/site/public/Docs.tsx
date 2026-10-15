import { useEffect, useMemo, useRef, useState } from 'react';
import {
  type DocPageKey,
  docAliases,
  docNavigation,
  docOrder,
  isDocPageKey,
} from '../../content/docs';
import { mdxDocs } from '../../content/mdxDocs';
import { href } from '../router';
import { mdxComponents } from './DocComponents';

const navigationLabels = new Map(
  docNavigation.flatMap((group) => group.pages.map(([key, label]) => [key, label])),
);

export function resolveDocKey(pageKey: string): DocPageKey {
  return isDocPageKey(pageKey) ? pageKey : (docAliases[pageKey] ?? 'overview');
}

export function docPath(key: DocPageKey): string {
  return key === 'overview' ? '/docs' : `/docs/${key}`;
}

function Pages({ current }: { current: DocPageKey }) {
  let number = 0;
  return (
    <>
      {docNavigation.map((group) => (
        <div key={group.label} className="cp-docs-group">
          <span className="cp-label">{group.label}</span>
          {group.pages.map(([key, label]) => {
            number += 1;
            return (
              <a
                key={key}
                href={href(docPath(key))}
                className="cp-docs-page"
                aria-current={key === current ? 'page' : undefined}
              >
                <span>{String(number).padStart(3, '0')}</span>
                <span>{label}</span>
              </a>
            );
          })}
        </div>
      ))}
    </>
  );
}

function Search({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [term, setTerm] = useState('');
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  const results = useMemo(() => {
    const needle = term.trim().toLowerCase();
    if (!needle) return [];
    return docOrder.flatMap((key) => {
      const doc = mdxDocs[key];
      return doc.sections
        .filter((section) =>
          `${doc.title} ${doc.lead} ${section.heading} ${section.text}`
            .toLowerCase()
            .includes(needle),
        )
        .slice(0, 4)
        .map((section) => ({ key, page: navigationLabels.get(key) ?? doc.title, ...section }));
    });
  }, [term]);

  return (
    <dialog ref={dialog} className="cp-dialog" aria-label="Search the docs" onClose={onClose}>
      <div className="cp-dialog-head">
        <span className="cp-micro">Search the docs</span>
        <button type="button" className="cp-btn-mono" onClick={onClose}>
          Close
        </button>
      </div>
      <input
        type="search"
        value={term}
        onChange={(event) => setTerm(event.currentTarget.value)}
        placeholder="Type to search"
        aria-label="Search terms"
        autoFocus
      />
      <div className="cp-dialog-results">
        {results.slice(0, 10).map((result) => (
          <a
            key={`${result.key}-${result.id}`}
            href={href(`${docPath(result.key)}?section=${result.id}`)}
            onClick={onClose}
          >
            {result.heading}
            <span>{result.page}</span>
          </a>
        ))}
        {term.trim() && results.length === 0 ? (
          <p>Nothing matches that. Try a command name or a file extension.</p>
        ) : null}
      </div>
    </dialog>
  );
}

function useActiveSection(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    if (!ids.length || !('IntersectionObserver' in window)) return;
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.set(entry.target.id, entry.boundingClientRect.top);
          else visible.delete(entry.target.id);
        }
        const top = [...visible.entries()].sort((a, b) => a[1] - b[1])[0];
        if (top) setActive(top[0]);
      },
      { rootMargin: '-10% 0px -70% 0px', threshold: 0 },
    );
    for (const id of ids) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [ids]);
  return active;
}

export function Docs({ pageKey, section }: { pageKey: string; section?: string }) {
  const key = resolveDocKey(pageKey);
  const doc = mdxDocs[key];
  const [searchOpen, setSearchOpen] = useState(false);
  const index = docOrder.indexOf(key);
  const previous = index > 0 ? docOrder[index - 1] : null;
  const next = index < docOrder.length - 1 ? docOrder[index + 1] : null;
  const label = navigationLabels.get(key) ?? doc.title;
  const outline = useMemo(() => doc.sections.filter((item) => item.level === 2), [doc.sections]);
  const outlineIds = useMemo(() => outline.map((item) => item.id), [outline]);
  const active = useActiveSection(outlineIds);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!section) return;
    document.getElementById(section)?.scrollIntoView({ behavior: 'instant', block: 'start' });
  }, [section]);

  const twin = `${docPath(key)}.md`;

  return (
    <main className="cp-wrap cp-docs">
      <div className="cp-titleblock">
        <div>
          <div className="cp-label">Section</div>
          <div className="cp-titleblock-value">Docs</div>
        </div>
        <div>
          <div className="cp-label">Page</div>
          <div className="cp-titleblock-value">{label}</div>
        </div>
        <div>
          <div className="cp-label">For agents</div>
          <a href={twin} className="cp-docs-md">
            {twin}
          </a>
        </div>
        <div>
          <div className="cp-label">Log</div>
          <div className="cp-titleblock-value cp-tabular">
            {String(index + 1).padStart(3, '0')} / {String(docOrder.length).padStart(3, '0')}
          </div>
        </div>
      </div>

      <div className="cp-docs-grid">
        <nav className="cp-docs-rail" aria-label="Documentation">
          <button type="button" className="cp-docs-search" onClick={() => setSearchOpen(true)}>
            Search
            <kbd>⌘K</kbd>
          </button>
          <Pages current={key} />
        </nav>

        <article className="cp-docs-article">
          {/* Keyed by page, so the menu is closed again on the page it opened. */}
          <details key={key} className="cp-docs-mobile">
            <summary aria-label="Documentation pages">
              <span className="cp-label">Docs</span>
              <b>{label}</b>
              <i aria-hidden="true" />
            </summary>
            <div>
              <button type="button" className="cp-docs-search" onClick={() => setSearchOpen(true)}>
                Search
              </button>
              <Pages current={key} />
            </div>
          </details>

          <h1>{doc.title}</h1>
          <p className="cp-docs-lead">{doc.lead}</p>
          <div className="cp-mdx">
            <doc.Content components={mdxComponents} />
          </div>

          <nav className="cp-docs-pager" aria-label="Previous and next page">
            {previous ? (
              <a href={href(docPath(previous))}>
                <span className="cp-label">Previous</span>
                {navigationLabels.get(previous)}
              </a>
            ) : (
              <span />
            )}
            {next ? (
              <a href={href(docPath(next))} data-next="">
                <span className="cp-label">Next</span>
                {navigationLabels.get(next)}
              </a>
            ) : null}
          </nav>
        </article>

        <nav className="cp-docs-outline" aria-label="On this page">
          <span className="cp-label">On this page</span>
          {outline.map((item) => (
            <a key={item.id} href={`#${item.id}`} data-active={item.id === active || undefined}>
              {item.heading}
            </a>
          ))}
          <div className="cp-docs-twin">
            <a href={twin}>This page as Markdown ↗</a>
          </div>
        </nav>
      </div>

      <Search open={searchOpen} onClose={() => setSearchOpen(false)} />
    </main>
  );
}
