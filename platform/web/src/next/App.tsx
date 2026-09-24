import { Anchor, Box, Text, useComputedColorScheme } from '@mantine/core';
import { useEffect, useState } from 'react';
import { Footer, Header, Page } from './components/Shell';
import { account as sampleAccount, traces } from './data/fixtures';
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
import { href, query, segments, useLinkNavigation, usePath } from './router';

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
  const [signedIn, setSignedIn] = useState(true);
  const [section, page] = segments(path);
  const scheme = useComputedColorScheme('light');
  useLinkNavigation();

  useEffect(() => {
    document.title = documentTitle(section, page);
  }, [section, page]);

  // The browser paints its own chrome from this, so it follows the resolved
  // scheme rather than the stored preference.
  useEffect(() => {
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', scheme === 'dark' ? '#0d1013' : '#eff0f2');
  }, [scheme]);

  // Docs keep their reading position when a section link moves within a page.
  useEffect(() => {
    if (section !== 'docs') window.scrollTo({ top: 0, behavior: 'instant' });
  }, [section, path]);

  const account = signedIn ? sampleAccount : null;
  const parameters = query(path);

  const accountView: AccountView = accountViews.includes(page as AccountView)
    ? (page as AccountView)
    : 'overview';

  let body: React.ReactNode;
  if (!section) body = <Landing signedIn={account !== null} />;
  else if (section === 'docs')
    body = <Docs pageKey={page ?? 'overview'} section={parameters.get('section') ?? undefined} />;
  else if (section === 'signin')
    body = <SignIn returnTo={parameters.get('return_to') ?? undefined} />;
  else if (section === 'authorize') body = <Authorize />;
  else if (section === 'privacy' || section === 'terms') body = <Legal pageKey={section} />;
  else if (section === 'app' && !account) body = <SignIn returnTo={path} />;
  else if (section === 'app')
    body = (
      <AccountShell view={accountView} counts={{ traces: traces.length }}>
        {accountView === 'overview' ? (
          <Overview />
        ) : accountView === 'traces' ? (
          <Traces />
        ) : accountView === 'usage' ? (
          <Usage />
        ) : (
          <Settings />
        )}
      </AccountShell>
    );
  else body = <NotFound path={path} />;

  const bare = section === 'signin' || section === 'authorize';

  return (
    <>
      {!bare ? (
        <Header
          account={account}
          onSignOut={() => setSignedIn(false)}
          showDownload={section === 'docs'}
        />
      ) : null}
      {body}
      <Footer />
    </>
  );
}
