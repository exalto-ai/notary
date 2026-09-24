import { useEffect, useState } from 'react';

// The prototype is mounted under a prefix so it can answer real URLs beside
// the shipped application. At cutover this becomes '' and nothing else about
// routing changes.
export const basePath = '/next';

function withoutBase(pathname: string): string {
  if (pathname === basePath) return '/';
  if (pathname.startsWith(`${basePath}/`)) return pathname.slice(basePath.length) || '/';
  return pathname;
}

/** The route, without the mount prefix, as `/docs/share?section=x`. */
export function currentPath(): string {
  return `${withoutBase(window.location.pathname)}${window.location.search}`;
}

/** A route turned into an address the browser can follow. */
export function href(path: string): string {
  const route = path.startsWith('/') ? path : `/${path}`;
  return route === '/' ? `${basePath}/` : `${basePath}${route}`;
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
      // Anything outside the mount prefix belongs to another application.
      if (url.pathname !== basePath && !url.pathname.startsWith(`${basePath}/`)) return;
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
