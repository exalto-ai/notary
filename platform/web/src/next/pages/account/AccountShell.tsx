import { Box, Text } from '@mantine/core';
import type { ReactNode } from 'react';
import { href } from '../../router';

export type AccountView = 'overview' | 'traces' | 'usage' | 'settings';

const items: { view: AccountView; label: string }[] = [
  { view: 'overview', label: 'Overview' },
  { view: 'traces', label: 'Traces' },
  { view: 'usage', label: 'Usage' },
  { view: 'settings', label: 'Settings' },
];

export function AccountShell({
  view,
  counts,
  children,
}: {
  view: AccountView;
  counts: Partial<Record<AccountView, string | number>>;
  children: ReactNode;
}) {
  return (
    <Box component="main" className="x-account">
      <Box component="nav" className="x-rail" aria-label="Account">
        {items.map((item) => (
          <Box
            key={item.view}
            component="a"
            href={href(`/app/${item.view}`)}
            className="x-rail-item"
            data-active={item.view === view || undefined}
            aria-current={item.view === view ? 'page' : undefined}
          >
            <Text component="span" fz="sm" fw={item.view === view ? 570 : 450}>
              {item.label}
            </Text>
            {counts[item.view] !== undefined ? (
              <Text component="span" className="x-data" c="var(--x-faint)" fz={12}>
                {counts[item.view]}
              </Text>
            ) : null}
          </Box>
        ))}
      </Box>
      <Box className="x-account-page">{children}</Box>
    </Box>
  );
}
