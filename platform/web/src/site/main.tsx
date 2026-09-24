import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/geist-mono';
// Only the component styles this application mounts. The full bundle carries
// every Mantine component, most of which are never rendered here.
import '@mantine/core/styles/baseline.css';
import '@mantine/core/styles/default-css-variables.css';
import '@mantine/core/styles/global.css';
import '@mantine/core/styles/ActionIcon.css';
import '@mantine/core/styles/Alert.css';
import '@mantine/core/styles/Anchor.css';
import '@mantine/core/styles/Button.css';
import '@mantine/core/styles/Checkbox.css';
import '@mantine/core/styles/CloseButton.css';
import '@mantine/core/styles/Combobox.css';
import '@mantine/core/styles/Drawer.css';
import '@mantine/core/styles/Group.css';
import '@mantine/core/styles/Input.css';
import '@mantine/core/styles/Loader.css';
import '@mantine/core/styles/Menu.css';
import '@mantine/core/styles/Modal.css';
import '@mantine/core/styles/ModalBase.css';
import '@mantine/core/styles/Overlay.css';
import '@mantine/core/styles/Paper.css';
import '@mantine/core/styles/Popover.css';
import '@mantine/core/styles/ScrollArea.css';
import '@mantine/core/styles/SegmentedControl.css';
import '@mantine/core/styles/Text.css';
import '@mantine/core/styles/UnstyledButton.css';
import '@mantine/core/styles/VisuallyHidden.css';
import './system.css';

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
