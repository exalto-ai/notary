import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/geist-mono';
import '@mantine/core/styles.css';
import './system.css';

import { MantineProvider } from '@mantine/core';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { cssVariablesResolver, theme } from './theme';

const root = document.getElementById('root');
if (root)
  createRoot(root).render(
    <MantineProvider
      theme={theme}
      cssVariablesResolver={cssVariablesResolver}
      defaultColorScheme="auto"
    >
      <App />
    </MantineProvider>,
  );
