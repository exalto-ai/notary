import { useEffect, useState } from 'react';

// The prototype is served from its own entry document, so it routes on the
// hash and leaves the production site's history handling untouched.

export function currentPath(): string {
  const hash = window.location.hash.replace(/^#/, '');
  return hash.startsWith('/') ? hash : '/';
}

export function href(path: string): string {
  return `#${path.startsWith('/') ? path : `/${path}`}`;
}

export function go(path: string): void {
  window.location.hash = path.startsWith('/') ? path : `/${path}`;
}

export function usePath(): string {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const update = () => setPath(currentPath());
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  return path;
}

export function segments(path: string): string[] {
  return path.split('?')[0].split('/').filter(Boolean);
}

export function query(path: string): URLSearchParams {
  return new URLSearchParams(path.split('?')[1] ?? '');
}
