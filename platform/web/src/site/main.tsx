import './styles';

import { MantineProvider } from '@mantine/core';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { App } from './App';
import { siteColorSchemeManager } from './colorScheme';
import { cssVariablesResolver, theme } from './theme';

const root = document.getElementById('root');
if (root) {
  const element = (
    <MantineProvider
      theme={theme}
      cssVariablesResolver={cssVariablesResolver}
      colorSchemeManager={siteColorSchemeManager()}
      defaultColorScheme="auto"
    >
      <App />
    </MantineProvider>
  );
  // The public pages ship prerendered (scripts/prerender.mjs), so their HTML
  // is already in the document and only needs hydrating. The account shell
  // arrives empty and is rendered here.
  if (root.hasChildNodes()) hydrateRoot(root, element);
  else createRoot(root).render(element);
}
