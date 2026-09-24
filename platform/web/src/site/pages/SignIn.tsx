import { Alert, Anchor, Box, Button, Loader, Text } from '@mantine/core';
import { type MouseEvent, useEffect, useState } from 'react';
import { apiHref, getAuthProviders } from '../../platform-api/client';
import { AuthProviderIcon } from '../components/AuthProviderIcon';
import { Wordmark } from '../components/Shell';
import { type Account, accountName } from '../data/account';
import { href } from '../router';

type AuthProvider = 'github' | 'google';
type Providers = Awaited<ReturnType<typeof getAuthProviders>>;

/**
 * Only a route this application owns is worth returning to, and the value
 * arrives in a query string a stranger can write, so it is matched against
 * what it is allowed to be rather than sanitised.
 */
export function allowedReturnTo(requested: string | null): string | null {
  if (!requested) return null;
  if (requested === '/app' || requested.startsWith('/app/')) return requested;
  if (requested.startsWith('/authorize?')) return requested;
  return null;
}

function Provider({
  provider,
  target,
  pending,
  disabled,
  onStart,
}: {
  provider: AuthProvider;
  target: string;
  pending: boolean;
  disabled: boolean;
  onStart: (provider: AuthProvider) => void;
}) {
  const name = provider === 'google' ? 'Google' : 'GitHub';
  const start = (event: MouseEvent<HTMLAnchorElement>) => {
    if (pending || disabled) {
      event.preventDefault();
      return;
    }
    onStart(provider);
  };
  return (
    <Button
      component="a"
      href={target}
      variant="default"
      h={44}
      justify="flex-start"
      onClick={start}
      data-disabled={disabled || undefined}
      aria-busy={pending || undefined}
      aria-disabled={disabled || undefined}
      leftSection={pending ? <Loader size={16} /> : <AuthProviderIcon provider={provider} />}
    >
      {pending ? `Opening ${name}` : `Continue with ${name}`}
    </Button>
  );
}

export function SignIn({
  returnTo: requestedReturnTo,
  account,
  loadError = null,
  loadProviders = getAuthProviders,
}: {
  returnTo?: string | null;
  account?: Account | null;
  /** Set when the account could not be read at all, which is not the same
   *  thing as being signed out. */
  loadError?: string | null;
  loadProviders?: typeof getAuthProviders;
}) {
  const [providers, setProviders] = useState<Providers | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState<AuthProvider | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadProviders()
      .then((next) => {
        if (!cancelled) setProviders(next);
      })
      .catch((reason) => {
        if (!cancelled)
          setError(reason instanceof Error ? reason.message : 'Could not load sign-in options.');
      });
    return () => {
      cancelled = true;
    };
  }, [loadProviders]);

  const returnTo = allowedReturnTo(requestedReturnTo ?? null);
  // The provider returns the reader to this application, so the address it is
  // sent back to carries the mount prefix.
  const target = (provider: AuthProvider) =>
    apiHref(
      `/api/auth/${provider}${returnTo ? `?return_to=${encodeURIComponent(href(returnTo))}` : ''}`,
    );

  if (account)
    return (
      <Box className="x-centered">
        <Box className="x-record" p={32} w="100%" maw={420}>
          <Wordmark size={22} />
          <Text component="h1" fz={26} fw={600} mt={24} lh={1.15}>
            You are already signed in.
          </Text>
          <Text fz="sm" c="var(--x-quiet)" mt={10}>
            Signed in as <b>{accountName(account)}</b>.
          </Text>
          <Button component="a" href={href(returnTo ?? '/app/overview')} h={42} mt={24} fullWidth>
            Open your account
          </Button>
        </Box>
      </Box>
    );

  const none = providers !== null && !providers.google && !providers.github;

  return (
    <Box className="x-centered">
      <Box className="x-record" p={32} w="100%" maw={420}>
        <Wordmark size={22} />
        {loadError ? (
          <Alert color="alert" variant="light" mt={20} title="Your account could not be read">
            {loadError}. You may already be signed in; reloading is worth a try before signing in
            again.
          </Alert>
        ) : null}
        <Text component="h1" fz={26} fw={600} mt={24} lh={1.15}>
          Sign in to manage what you share.
        </Text>
        <Text fz="sm" c="var(--x-quiet)" mt={10}>
          Capture records and seals without an account. You need one to host a trace at a link, or
          to seal with Exalto Seal instead of a notary you run yourself.
        </Text>

        <Box mt={28} style={{ display: 'grid', gap: 10 }}>
          {error ? (
            <Alert color="alert" title="Sign-in options are unavailable" variant="light">
              {error}
            </Alert>
          ) : none ? (
            <Alert color="alert" title="No sign-in provider is configured" variant="light">
              This deployment has no way to sign you in. Contact whoever operates it.
            </Alert>
          ) : providers === null ? (
            // The buttons are about to stand here, so the wait keeps their shape.
            <>
              <Box
                h={44}
                className="x-sunken"
                style={{ borderRadius: 4 }}
                role="status"
                aria-label="Loading sign-in options"
              />
              <Box h={44} className="x-sunken" style={{ borderRadius: 4 }} aria-hidden="true" />
            </>
          ) : (
            (['google', 'github'] as const)
              .filter((provider) => providers[provider])
              .map((provider) => (
                <Provider
                  key={provider}
                  provider={provider}
                  target={target(provider)}
                  pending={starting === provider}
                  disabled={starting !== null && starting !== provider}
                  onStart={setStarting}
                />
              ))
          )}
        </Box>

        <Text fz={12.5} c="var(--x-quiet)" mt={24}>
          By continuing you agree to the{' '}
          <Anchor href={href('/terms')} fz={12.5} c="var(--x-seal)">
            Terms
          </Anchor>{' '}
          and acknowledge the{' '}
          <Anchor href={href('/privacy')} fz={12.5} c="var(--x-seal)">
            Privacy Policy
          </Anchor>
          .
        </Text>
      </Box>
    </Box>
  );
}
