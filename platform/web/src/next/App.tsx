import { Anchor, Box, Text, useComputedColorScheme } from '@mantine/core';
import { useEffect } from 'react';
import { useSettledWait } from '../site/LoadingStates';
import { AccountPlaceholder } from './components/AccountPlaceholder';
import { Footer, Header, Page } from './components/Shell';
import { useAccount } from './data/account';
import { documentTitle } from './documentTitle';
import { Authorize } from './pages/Authorize';
import { AccountShell, type AccountView } from './pages/account/AccountShell';
import { Overview } from './pages/account/Overview';
import { Settings } from './pages/account/Settings';
import { Traces } from './pages/account/Traces';
import { Usage } from './pages/account/Usage';
import { Docs } from './pages/Docs';
import { Landing } from './pages/Landing';
import { Legal } from './pages/Legal';
import { SignIn } from './pages/SignIn';
import { go, href, query, segments, useLinkNavigation, usePath } from './router';

const accountViews: AccountView[] = ['overview', 'traces', 'usage', 'settings'];

function NotFound({ path }: { path: string }) {
  return (
    <Page width={640}>
      <Box py={96}>
        <Text component="h1" fz={33} fw={620} m={0}>
          That page is not here.
        </Text>
        <Text c="var(--x-quiet)" mt="sm">
          Nothing answers to{' '}
          <Text component="span" className="x-data">
            {path}
          </Text>
          .
        </Text>
        <Anchor href={href('/')} fz="sm" c="var(--x-seal)" display="inline-block" mt="lg">
          Back to Exalto Capture
        </Anchor>
      </Box>
    </Page>
  );
}

export function App() {
  const path = usePath();
  const [section, page] = segments(path);
  const parameters = query(path);
  const scheme = useComputedColorScheme('light');
  const { account, pending, error, refresh, signOut, forget } = useAccount();
  useLinkNavigation();

  useEffect(() => {
    document.title = documentTitle(section, page);
  }, [section, page]);

  useEffect(() => {
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', scheme === 'dark' ? '#0d1013' : '#eff0f2');
  }, [scheme]);

  useEffect(() => {
    if (section !== 'docs') window.scrollTo({ top: 0, behavior: 'instant' });
  }, [section, path]);

  const accountView: AccountView = accountViews.includes(page as AccountView)
    ? (page as AccountView)
    : 'overview';
  // The account is the only section that has to wait for an answer. Everything
  // else renders while the session resolves.
  const waiting = section === 'app' && pending;
  const placeholderVisible = useSettledWait(waiting);

  let body: React.ReactNode;
  if (!section) body = <Landing signedIn={account !== null} />;
  else if (section === 'docs')
    body = <Docs pageKey={page ?? 'overview'} section={parameters.get('section') ?? undefined} />;
  else if (section === 'signin')
    body = <SignIn returnTo={parameters.get('return_to')} account={account} />;
  else if (section === 'authorize') body = <Authorize route={path} account={account} />;
  else if (section === 'privacy' || section === 'terms') body = <Legal pageKey={section} />;
  else if (section === 'app' && waiting) body = placeholderVisible ? <AccountPlaceholder /> : null;
  else if (section === 'app' && !account)
    body = (
      <>
        {error ? (
          <Box className="x-prototype-notice" role="alert">
            <Text component="span" fz={12.5} c="var(--x-alert)">
              Your account could not be loaded: {error}
            </Text>
          </Box>
        ) : null}
        <SignIn returnTo={`/${path.replace(/^\//, '')}`} account={null} />
      </>
    );
  else if (section === 'app' && account)
    body = (
      <>
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
      </>
    );
  else body = <NotFound path={path} />;

  const bare = section === 'signin' || section === 'authorize';

  return (
    <>
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
