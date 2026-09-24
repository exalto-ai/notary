import { useEffect, useState } from 'react';

// The application is mounted at the origin root. Vercel rewrites every path
// that is not an asset to the index document, so a deep link resolves.

/** The route, without the mount prefix, as `/docs/share?section=x`. */
export function currentPath(): string {
  return `${window.location.pathname || '/'}${window.location.search}`;
}

/** A route turned into an address the browser can follow. */
export function href(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

export function go(path: string): void {
  const target = href(path);
  if (target === `${window.location.pathname}${window.location.search}`) return;
  window.history.pushState({}, '', target);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function usePath(): string {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const update = () => setPath(currentPath());
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  return path;
}

export function segments(path: string): string[] {
  return path.split('?')[0].split('/').filter(Boolean);
}

export function query(path: string): URLSearchParams {
  return new URLSearchParams(path.split('?')[1] ?? '');
}

/**
 * Links are written as ordinary anchors so they open in a new tab, copy, and
 * survive a hard reload. This turns a plain left click on one of them into an
 * in-page navigation instead of a document load.
 */
export function useLinkNavigation(): void {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.('a');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href, window.location.origin);
      if (url.origin !== window.location.origin) return;
      // A link to an anchor on the page this already is belongs to the
      // browser, which knows how to scroll to it.
      const sameDocument =
        `${url.pathname}${url.search}` === `${window.location.pathname}${window.location.search}`;
      if (sameDocument) return;
      event.preventDefault();
      window.history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
}
