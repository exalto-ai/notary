import {
  ActionIcon,
  Anchor,
  Box,
  Button,
  Menu,
  Text,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { IconMoon, IconSun } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { type Account, accountName, authProviderName } from '../data/account';
import { href } from '../router';

/**
 * The wordmark keeps the brand's own typeface. The interface around it speaks
 * in Archivo, so the signature and the instrument never sound the same.
 */
export function Wordmark({ size = 19 }: { size?: number }) {
  return (
    <Box
      component="a"
      href={href('/')}
      aria-label="Exalto Capture home"
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 8,
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <Text
        component="span"
        fz={size}
        fw={640}
        style={{
          fontFamily: "'Fraunces Variable', Georgia, serif",
          letterSpacing: '-0.012em',
          lineHeight: 1,
        }}
      >
        Exalto
      </Text>
      <Text
        component="span"
        fz={size - 5}
        fw={520}
        c="var(--x-quiet)"
        style={{ lineHeight: 1, letterSpacing: '0.005em' }}
      >
        Capture
      </Text>
    </Box>
  );
}

function ColorSchemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  // Resolved, not stored: with the preference on "auto" the control still has
  // to show what the reader is actually looking at.
  const dark = useComputedColorScheme('light') === 'dark';
  return (
    <ActionIcon
      variant="subtle"
      color="gray"
      size="md"
      aria-label={dark ? 'Use the light appearance' : 'Use the dark appearance'}
      onClick={() => setColorScheme(dark ? 'light' : 'dark')}
    >
      {dark ? <IconSun size={17} stroke={1.6} /> : <IconMoon size={17} stroke={1.6} />}
    </ActionIcon>
  );
}

export function Header({
  account,
  onSignOut,
  authPending = false,
  showDownload = false,
}: {
  account: Account | null;
  onSignOut?: () => void;
  authPending?: boolean;
  showDownload?: boolean;
}) {
  const name = account ? accountName(account) : '';
  return (
    <Box
      component="header"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 24,
        padding: '0 var(--x-gutter)',
        borderBottom: '1px solid var(--x-rule)',
        background: 'color-mix(in srgb, var(--x-shell) 88%, transparent)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <Wordmark />
      <Box style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Anchor href={href('/docs')} fz="sm" c="var(--x-quiet)" underline="never" px={8}>
          Docs
        </Anchor>
        <ColorSchemeToggle />
        {showDownload ? (
          <Button component="a" href={href('/')} size="xs" h={30} px={14}>
            Download
          </Button>
        ) : null}
        {account ? (
          <Menu position="bottom-end" width={240} shadow="md">
            <Menu.Target>
              <ActionIcon
                variant="default"
                size={30}
                radius="xl"
                aria-label={`Account menu for ${name}`}
                style={{ overflow: 'hidden' }}
              >
                {account.avatar_url ? (
                  <img
                    src={account.avatar_url}
                    alt=""
                    referrerPolicy="no-referrer"
                    width={30}
                    height={30}
                    style={{ display: 'block', objectFit: 'cover' }}
                  />
                ) : (
                  <Text fz={11} fw={600}>
                    {name.slice(0, 2).toUpperCase()}
                  </Text>
                )}
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Box px={12} py={8}>
                <Text fz="sm" fw={550}>
                  {name}
                </Text>
                <Text fz="xs" c="var(--x-quiet)">
                  {/* A Google account often reports the person's name as its
                      identifier, and printing it twice reads as a mistake. */}
                  {account.provider_display_name === name
                    ? authProviderName(account)
                    : `${account.provider_display_name}, ${authProviderName(account)}`}
                </Text>
              </Box>
              <Menu.Divider />
              <Menu.Item component="a" href={href('/app/overview')}>
                Account
              </Menu.Item>
              <Menu.Item component="a" href={href('/app/settings')}>
                Settings
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item onClick={onSignOut}>Sign out</Menu.Item>
            </Menu.Dropdown>
          </Menu>
        ) : authPending ? (
          // The control is about to be here either way, so the wait keeps its
          // footprint rather than shifting the bar when the session answers.
          <Box className="x-skeleton" w={72} h={30} style={{ borderRadius: 4 }} />
        ) : (
          <Button component="a" href={href('/signin')} variant="default" size="xs" h={30} px={14}>
            Sign in
          </Button>
        )}
      </Box>
    </Box>
  );
}

export function Footer() {
  return (
    <Box
      component="footer"
      mt={64}
      style={{
        borderTop: '1px solid var(--x-rule)',
        padding: '20px var(--x-gutter)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 20,
        flexWrap: 'wrap',
      }}
    >
      <Text fz="xs" c="var(--x-quiet)">
        Exalto Capture records on your machine. Exalto Seal signs what you choose to seal.
      </Text>
      <Box style={{ display: 'flex', gap: 18 }}>
        <Anchor href={href('/privacy')} fz="xs" c="var(--x-quiet)" underline="hover">
          Privacy
        </Anchor>
        <Anchor href={href('/terms')} fz="xs" c="var(--x-quiet)" underline="hover">
          Terms
        </Anchor>
        <Anchor href="https://exalto.ai" fz="xs" c="var(--x-quiet)" underline="hover">
          exalto.ai
        </Anchor>
      </Box>
    </Box>
  );
}

export function Page({ children, width = 1120 }: { children: ReactNode; width?: number }) {
  return (
    <Box component="main" mx="auto" px="var(--x-gutter)" style={{ maxWidth: width }}>
      {children}
    </Box>
  );
}
