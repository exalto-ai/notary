import { Box, Text, useComputedColorScheme } from '@mantine/core';
import { useEffect } from 'react';
import { AccountPlaceholder } from './components/AccountPlaceholder';
import { Lamp } from './components/primitives';
import { Footer, Header } from './components/Shell';
import { useAccount } from './data/account';
import { documentTitle } from './documentTitle';
import { Authorize } from './pages/Authorize';
import { AccountShell, type AccountView } from './pages/account/AccountShell';
import { Overview } from './pages/account/Overview';
import { Settings } from './pages/account/Settings';
import { Traces } from './pages/account/Traces';
import { Usage } from './pages/account/Usage';
import { Docs } from './pages/Docs';
import { Legal } from './pages/Legal';
import { SignIn } from './pages/SignIn';
import { localPreview } from './preview';
import { Landing } from './public/Landing';
import { PublicLayout, PublicNotFound } from './public/PublicShell';
import { go, query, segments, useLinkNavigation, usePath } from './router';
import { useSettledWait } from './settledWait';

const accountViews: AccountView[] = ['overview', 'traces', 'usage', 'settings'];

// The public pages (DESIGN.md Part IIB) and the account surfaces (Part IIC)
// are two shells over one application. A route belongs to exactly one.
const apertureSections = new Set(['docs', 'signin', 'authorize', 'privacy', 'terms', 'app']);

export function App() {
  const path = usePath();
  const [section, page] = segments(path);
  const parameters = query(path);
  const scheme = useComputedColorScheme('light');
  const { account, pending, error, refresh, signOut, forget } = useAccount();
  useLinkNavigation();
  const aperture = section !== undefined && apertureSections.has(section);

  useEffect(() => {
    document.title = documentTitle(section, page);
  }, [section, page]);

  // The document behind the public shell is graphite (overscroll, and the
  // first paint before hydration); index.html sets the same class statically.
  useEffect(() => {
    document.documentElement.classList.toggle('cp-root', !aperture);
  }, [aperture]);

  useEffect(() => {
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', aperture ? (scheme === 'dark' ? '#0d1013' : '#eff0f2') : '#201e1d');
  }, [scheme, aperture]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: path is intentional; scroll to top on every route change, not only section changes.
  useEffect(() => {
    if (section !== 'docs' && !window.location.hash)
      window.scrollTo({ top: 0, behavior: 'instant' });
  }, [section, path]);

  const accountView: AccountView = accountViews.includes(page as AccountView)
    ? (page as AccountView)
    : 'overview';
  // The account is the only section that has to wait for an answer. Everything
  // else renders while the session resolves.
  const waiting = section === 'app' && pending;
  const placeholderVisible = useSettledWait(waiting);

  if (!aperture) {
    const session = pending ? 'pending' : account ? 'signed-in' : 'signed-out';
    return (
      <PublicLayout session={session}>
        {section ? <PublicNotFound path={path} /> : <Landing />}
      </PublicLayout>
    );
  }

  let body: React.ReactNode = null;
  if (section === 'docs')
    body = <Docs pageKey={page ?? 'overview'} section={parameters.get('section') ?? undefined} />;
  else if (section === 'signin')
    body = <SignIn returnTo={parameters.get('return_to')} account={account} />;
  else if (section === 'authorize') body = <Authorize route={path} account={account} />;
  else if (section === 'privacy' || section === 'terms') body = <Legal pageKey={section} />;
  else if (section === 'app' && waiting) body = placeholderVisible ? <AccountPlaceholder /> : null;
  else if (section === 'app' && !account)
    body = <SignIn returnTo={`/${path.replace(/^\//, '')}`} account={null} loadError={error} />;
  else if (section === 'app' && account)
    body = (
      <AccountShell view={accountView} counts={{ traces: account.usage.hosted_traces.total }}>
        {accountView === 'overview' ? (
          <Overview account={account} />
        ) : accountView === 'traces' ? (
          <Traces />
        ) : accountView === 'usage' ? (
          <Usage account={account} route={path} onAccountChanged={refresh} />
        ) : (
          <Settings
            account={account}
            onAccountDeleted={() => {
              forget();
              go('/');
            }}
          />
        )}
      </AccountShell>
    );

  const bare = section === 'signin' || section === 'authorize';

  return (
    <>
      {localPreview ? (
        <Box className="x-preview-notice" role="note">
          <Lamp tone="local">Local preview</Lamp>
          <Text component="span" fz={12.5}>
            Sample data from a development fixture service. Nothing here is verified evidence.
          </Text>
        </Box>
      ) : null}
      {!bare ? (
        <Header
          account={account}
          onSignOut={signOut}
          authPending={pending}
          showDownload={section === 'docs'}
        />
      ) : null}
      {body}
      {!waiting ? <Footer /> : null}
    </>
  );
}
