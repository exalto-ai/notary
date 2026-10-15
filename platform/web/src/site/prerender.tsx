// The server entry for prerendering the public pages. scripts/prerender.mjs
// builds this with Vite's SSR mode and calls render() for every public route;
// the result is written into the built index document so a fetch of the page
// returns its content without running any script.
import { MantineProvider } from '@mantine/core';
import { renderToString } from 'react-dom/server';
import { App } from './App';
import { documentTitle } from './documentTitle';
import { segments, setServerPath } from './router';
import { cssVariablesResolver, theme } from './theme';

export function render(path: string): { html: string; title: string } {
  setServerPath(path);
  try {
    const html = renderToString(
      <MantineProvider
        theme={theme}
        cssVariablesResolver={cssVariablesResolver}
        defaultColorScheme="light"
        forceColorScheme="light"
      >
        <App />
      </MantineProvider>,
    );
    const [section, page] = segments(path);
    return { html, title: documentTitle(section, page) };
  } finally {
    setServerPath(null);
  }
}

import { docNavigation, docOrder } from '../content/docs';
import { legalPages } from '../content/legal';
import { mdxDocs } from '../content/mdxDocs';

export type PublicRoute = {
  path: string;
  /** Output file under dist, without the extension. */
  file: string;
  kind: 'landing' | 'docs' | 'legal';
  title: string;
  description: string;
  label: string;
};

/** Every public route, in the order the markdown index lists them. */
export function publicRoutes(): PublicRoute[] {
  const labels = new Map(
    docNavigation.flatMap((group) => group.pages.map(([key, label]) => [key, label])),
  );
  const docs: PublicRoute[] = docOrder.map((key) => ({
    path: key === 'overview' ? '/docs' : `/docs/${key}`,
    file: key === 'overview' ? 'docs' : `docs/${key}`,
    kind: 'docs',
    title: mdxDocs[key].title,
    description: mdxDocs[key].lead,
    label: labels.get(key) ?? mdxDocs[key].title,
  }));
  const legal: PublicRoute[] = (['privacy', 'terms'] as const).map((key) => ({
    path: `/${key}`,
    file: key,
    kind: 'legal',
    title: legalPages[key].title,
    description: legalPages[key].intro,
    label: legalPages[key].title,
  }));
  return [
    {
      path: '/',
      file: 'index',
      kind: 'landing',
      title: 'Exalto Capture · The flight recorder for your AI work',
      description:
        'The flight recorder for your AI work. Capture your sessions on your machine, have a third party seal the ones you need to show, and let anyone verify them. The desktop app, the SDK and CLI, and the open protocol underneath.',
      label: 'Exalto Capture',
    },
    ...docs,
    ...legal,
  ];
}
