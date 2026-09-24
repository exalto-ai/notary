import './styles';

import { MantineProvider } from '@mantine/core';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { siteColorSchemeManager } from './colorScheme';
import { cssVariablesResolver, theme } from './theme';

const root = document.getElementById('root');
if (root)
  createRoot(root).render(
    <MantineProvider
      theme={theme}
      cssVariablesResolver={cssVariablesResolver}
      colorSchemeManager={siteColorSchemeManager()}
      defaultColorScheme="auto"
    >
      <App />
    </MantineProvider>,
  );
