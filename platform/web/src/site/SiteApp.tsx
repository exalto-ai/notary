import type { MouseEvent as ReactMouseEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/newsreader/opsz.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-ext-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource/ibm-plex-mono/latin-ext-500.css';
import { AuthProviderIcon } from '../AuthProviderIcon';
import { initialThemePreference, resolvedTheme } from '../theme';
import '../shadcn.css';
import '../action-tokens.css';
import '../styles.css';
import '../account.css';
import '../auth.css';
import '../trace.css';
import '../docs.css';
import '../legal.css';
import '../notaries.css';
import '../axis.css';
import '../verification.css';
import '../landing.css';
import '../sharing.css';
import '../app-surface.css';
import { getAuthProviders, getCurrentUser, logoutBrowser } from '../platform-api/client';
import { AccountSettings, ApiKeysPanel, Dashboard, DeleteAccountPanel } from './AccountDashboard';
import {
  DeviceAuthorizationApproval,
  HostedNotaryRecord,
  RegistryPage,
} from './AuthorizationPages';
import { LandingPage } from './LandingPage';
import { AccountPlaceholder, useSettledWait } from './LoadingStates';
import { currentRoute, migrateLegacyRoute, navigateTo } from './navigation';
import { Docs } from './PublicDocs';
import { PublicTracePage, PublicTraces, VerificationPage } from './PublicTracePages';
import { rememberSession } from './session';

const loadCreditUtilizationChart = () => import('../CreditUtilizationChart');
type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
type AccountIdentity = Pick<
  CurrentUser,
  'auth_provider' | 'avatar_url' | 'display_name' | 'provider_display_name'
>;
type AuthProviders = Awaited<ReturnType<typeof getAuthProviders>>;
type AuthProvider = 'github' | 'google';
function accountName(user: AccountIdentity) {
  return user.display_name || user.provider_display_name;
}

function accountIdentifier(user: AccountIdentity) {
  return user.provider_display_name;
}

function authProviderName(user: AccountIdentity) {
  return user.auth_provider === 'google' ? 'Google' : 'GitHub';
}

function AccountMenu({ user, onLogout }: { user: AccountIdentity; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const name = accountName(user);
  const identifier = accountIdentifier(user);
  const initials = name.slice(0, 2).toUpperCase();
  useEffect(() => {
    const closeFromPointer = (event: MouseEvent) => {
      if (!(event.target instanceof Node) || !menuRef.current?.contains(event.target))
        setOpen(false);
    };
    const closeFromKeyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', closeFromPointer);
    window.addEventListener('keydown', closeFromKeyboard);
    return () => {
      document.removeEventListener('mousedown', closeFromPointer);
      window.removeEventListener('keydown', closeFromKeyboard);
    };
  }, []);
  return (
    <div className="account-menu" ref={menuRef}>
      <button
        type="button"
        className="account-trigger"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Account menu for ${name}`}
      >
        {user.avatar_url ? (
          <img src={user.avatar_url} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span>{initials}</span>
        )}
      </button>
      {open && (
        <nav className="account-popover" aria-label="Account">
          <div className="account-identity">
            <div>
              <b>{name}</b>
              <span>
                {identifier} · {authProviderName(user)}
              </span>
            </div>
          </div>
          <div className="account-actions">
            <a href="/app/" onClick={() => setOpen(false)}>
              Dashboard
            </a>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
            >
              Sign out
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}

export function Header({
  user,
  onLogout,
  hideSignIn = false,
  authPending = false,
}: {
  user: AccountIdentity | null;
  onLogout: () => void;
  hideSignIn?: boolean;
  authPending?: boolean;
}) {
  return (
    <header className="app-nav">
      <a className="app-brand" href="/" aria-label="Exalto Seal home">
        <span>Seal</span>
        <small>BY EXALTO</small>
      </a>
      <nav className="app-nav-links" aria-label="Product">
        <a href="/docs">Docs</a>
        <a href="/verify">Verify</a>
      </nav>
      <div className="app-nav-actions">
        {user ? (
          <AccountMenu user={user} onLogout={onLogout} />
        ) : !hideSignIn && authPending ? (
          <span
            className="account-auth-placeholder"
            role="status"
            aria-label="Checking sign-in status"
          >
            <i />
          </span>
        ) : (
          !hideSignIn && (
            <a className="app-sign-in-link" href="/signin">
              Sign in
            </a>
          )
        )}
      </div>
    </header>
  );
}

function AuthProviderLink({
  provider,
  href,
  pendingProvider,
  onStart,
}: {
  provider: AuthProvider;
  href: string;
  pendingProvider: AuthProvider | null;
  onStart: (provider: AuthProvider) => void;
}) {
  const name = provider === 'google' ? 'Google' : 'GitHub';
  const pending = pendingProvider === provider;
  const disabled = pendingProvider !== null && !pending;
  const className = `auth-provider${pending ? ' auth-provider--pending' : ''}${disabled ? ' auth-provider--disabled' : ''}`;
  const start = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    if (pendingProvider !== null) {
      event.preventDefault();
      return;
    }
    onStart(provider);
  };
  return (
    <a
      className={className}
      href={href}
      onClick={start}
      aria-busy={pending || undefined}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : undefined}
    >
      <AuthProviderIcon provider={provider} />
      <b>{pending ? `Connecting to ${name}…` : `Continue with ${name}`}</b>
      <span className="auth-provider-progress" aria-hidden="true">
        {pending && (
          <>
            <i />
            <i />
            <i />
          </>
        )}
      </span>
    </a>
  );
}

export function SignInPage({
  route = 'signin',
  user = null,
  loadProviders = getAuthProviders,
}: {
  route?: string;
  user?: AccountIdentity | null;
  loadProviders?: typeof getAuthProviders;
}) {
  const [providers, setProviders] = useState<AuthProviders | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingProvider, setPendingProvider] = useState<AuthProvider | null>(null);
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
  const requestedReturn = new URLSearchParams(route.split('?')[1] || '').get('return_to');
  const returnTo =
    requestedReturn?.startsWith('/authorize?') ||
    requestedReturn === '/app' ||
    requestedReturn?.startsWith('/app/') ||
    requestedReturn === '/account' ||
    requestedReturn?.startsWith('/account/') ||
    requestedReturn?.startsWith('#/authorize?') ||
    requestedReturn === '#/account' ||
    requestedReturn?.startsWith('#/account/')
      ? requestedReturn
      : null;
  const providerHref = (provider: AuthProvider) =>
    `/api/auth/${provider}${returnTo ? `?return_to=${encodeURIComponent(returnTo)}` : ''}`;
  if (user)
    return (
      <main className="app-sign-in">
        <section className="app-sign-in-panel">
          <span className="app-kicker">EXALTO SEAL</span>
          <h1>You’re already here.</h1>
          <p>
            You’re signed in as <b>{accountName(user)}</b>.
          </p>
          <a className="app-primary-action" href={returnTo || '/app/'}>
            Open dashboard <span aria-hidden="true">→</span>
          </a>
        </section>
      </main>
    );
  return (
    <main className="app-sign-in">
      <section className="app-sign-in-panel" aria-labelledby="sign-in-title">
        <span className="app-kicker">EXALTO SEAL · YOUR WORKSPACE</span>
        <h1 id="sign-in-title">Keep the record close.</h1>
        <p>Sign in to manage Capture, Sealed Traces, and your account.</p>
        {error ? (
          <div className="auth-state" role="alert">
            <b>Sign-in options are unavailable</b>
            <span>{error}</span>
          </div>
        ) : providers === null ? (
          <div className="auth-state" role="status">
            <b>Loading sign-in options</b>
          </div>
        ) : (
          <div className="auth-provider-list">
            {providers.google && (
              <AuthProviderLink
                provider="google"
                href={providerHref('google')}
                pendingProvider={pendingProvider}
                onStart={setPendingProvider}
              />
            )}
            {providers.github && (
              <AuthProviderLink
                provider="github"
                href={providerHref('github')}
                pendingProvider={pendingProvider}
                onStart={setPendingProvider}
              />
            )}
            {!providers.google && !providers.github && (
              <div className="auth-state" role="alert">
                <b>No sign-in provider is configured</b>
              </div>
            )}
          </div>
        )}
        <p className="auth-legal">
          By continuing, you agree to the <a href="/terms">Terms</a> and acknowledge the{' '}
          <a href="/privacy">Privacy Policy</a>.
        </p>
      </section>
    </main>
  );
}

export function Footer() {
  return (
    <footer className="app-footer">
      <a className="footer-copyright" href="https://exalto.ai">
        Exalto
      </a>
      <nav aria-label="Footer">
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
      </nav>
    </footer>
  );
}

const legalPages = {
  privacy: {
    eyebrow: 'Legal · Privacy',
    title: 'Privacy Policy',
    intro:
      'This policy explains the information handled by Exalto Seal and Exalto Capture, including the hosted Trace-sharing service and local tooling.',
    sections: [
      [
        'Local capture stays local',
        'The local proxy handles application plaintext and provider credentials. Within the protocol, the remote notary witnesses encrypted traffic and protocol metadata; it does not receive your API key, prompt, or response plaintext.',
      ],
      [
        'Account information',
        'If you sign in with Google, we use your stable Google account identifier, display name, and profile image to operate your account. We check that Google reports a verified email address but do not retain the address. Google access is limited to openid, email, and profile. If configured, GitHub sign-in remains available for existing accounts and requests identity only, without repository, organization, or email access. Provider access tokens are not retained.',
      ],
      [
        'Shared Traces',
        'Sharing is an explicit action on a notarized Trace. The service verifies and safety-scans a submitted .llmtrace package before admission, then hosts the disclosed conversation and exact admitted package at a stable link. Header values are hidden by the package’s default disclosure policy, but request and response bodies—including prompts, responses, tool definitions, and tool results—may be accessible. Do not share content you are not permitted to disclose.',
      ],
      [
        'Service processing',
        'One-off verification does not retain an uploaded package. Sharing retains the exact admitted package and its normalized trace so visitors can inspect the Trace and independently verify the original bytes. Temporary intake objects are removed after admission or rejection.',
      ],
      [
        'Plan, usage, and billing',
        'We record the capture and notarization bytes your account settles and the storage your uploaded packages occupy, so allowances and balances can be enforced. Paid plans and additional notarization are processed by Stripe as our payment processor; card details are handled by Stripe and are not stored by this service.',
      ],
      [
        'Devices and API keys',
        'Connecting a device stores a rotating device credential and the metadata needed to list and revoke it. A deployment API key is stored only as a verifier; the complete key is shown once at creation and cannot be retrieved afterwards. You can revoke either from hosted Account settings.',
      ],
      [
        'Cookies',
        'The hosted site sets host-only cookies only where they are strictly necessary. Signing in sets a session cookie, and the sign-in redirect briefly sets state and verifier cookies for that one exchange. Separately, unlocking a password-protected shared Trace sets a cookie for that Trace so you are not asked again for 24 hours; that one is set for visitors who are not signed in. We do not set advertising or cross-site tracking cookies.',
      ],
      [
        'Deleting your account',
        'Deleting your account removes the account record and queues every stored trace artifact it owns for deletion, and signs you out. Local traces on your own devices are not touched; disconnecting or deleting does not remove evidence you hold locally.',
      ],
      [
        'Trace reports',
        'A report retains the selected reason and optional note for moderation. Reports are append-only. A keyed network-derived value rate-limits submissions separately, and the application does not store the reporter’s raw IP address in the report record.',
      ],
      [
        'Your choices',
        'You choose whether a shared Trace is Unlisted or Listed. Both start accessible to anyone with the link; Unlisted only keeps it out of public Traces. After admission, you can stop sharing, require a password, or set an expiry. Keep private capture checkpoints and credentials under your control. For privacy questions or requests, contact the Exalto Seal operator through the project’s support channel.',
      ],
      [
        'Updates',
        'We may revise this policy as the service evolves. The current version will always be available on this page.',
      ],
    ],
  },
  terms: {
    eyebrow: 'Legal · Terms',
    title: 'Terms of Service',
    intro:
      'These terms govern your use of Exalto Seal, Exalto Capture, the local tooling, and the Trace-sharing service.',
    sections: [
      [
        'Using the service',
        'Use Exalto Seal and Exalto Capture lawfully and only with content, credentials, and provider accounts you are authorized to use. Do not interfere with the service, bypass access controls, or submit material that infringes the rights of others.',
      ],
      [
        'Your shared Traces',
        'You are responsible for every package you choose to submit. Sharing is an explicit consent boundary: once admitted, its disclosed conversation and exact package can be accessed by anyone with the link. Unlisted is not private; it only keeps the Trace out of public Traces.',
      ],
      [
        'What verification means',
        'The retained .llmtrace package can be checked against its cryptographic and protocol evidence. The readable conversation is derived from that admitted package, and the download preserves its exact bytes. Neither result establishes that a model output or user interpretation is true, complete, safe, or suitable for a particular purpose.',
      ],
      [
        'Availability',
        'The service is provided on an “as available” basis and may change, be suspended, or be discontinued. Preserve the local materials you need; do not rely on the service as your only record or backup.',
      ],
      [
        'Your responsibilities',
        'You are responsible for maintaining the security of your devices, local captures, API credentials, and account. Do not share confidential, personal, or otherwise protected information unless you have a clear right to do so.',
      ],
      [
        'Changes to these terms',
        'We may update these terms as the product develops. Continued use after an updated version is posted means you accept the revised terms.',
      ],
    ],
  },
} as const;

type LegalPageKey = keyof typeof legalPages;

function isLegalPage(pageKey: string | undefined): pageKey is LegalPageKey {
  return pageKey !== undefined && pageKey in legalPages;
}

function LegalPage({ pageKey }: { pageKey: LegalPageKey }) {
  const page = legalPages[pageKey];
  return (
    <main className="legal-shell">
      <span className="eyebrow">{page.eyebrow}</span>
      <h1>{page.title}</h1>
      <p className="legal-intro">{page.intro}</p>
      <p className="legal-updated">Last updated: August 2026</p>
      <div className="legal-sections">
        {page.sections.map(([heading, copy]) => (
          <section key={heading}>
            <h2>{heading}</h2>
            <p>{copy}</p>
          </section>
        ))}
      </div>
    </main>
  );
}

export {
  AccountSettings,
  ApiKeysPanel,
  Dashboard,
  DeleteAccountPanel,
  DeviceAuthorizationApproval,
  HostedNotaryRecord,
  PublicTracePage,
  PublicTraces,
  RegistryPage,
  VerificationPage,
};

export function App({
  loadCurrentUser = getCurrentUser,
}: {
  loadCurrentUser?: typeof getCurrentUser;
} = {}) {
  const [route, setRoute] = useState(currentRoute);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [authPending, setAuthPending] = useState(true);
  const [theme, setTheme] = useState(initialThemePreference);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      const activeTheme = resolvedTheme(theme, media.matches);
      document.documentElement.dataset.theme = activeTheme;
      document.documentElement.style.colorScheme = activeTheme;
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', activeTheme === 'dark' ? '#171717' : '#f6f5f2');
    };
    applyTheme();
    window.localStorage.setItem('notary-theme', theme);
    if (theme === 'auto') media.addEventListener('change', applyTheme);
    return () => media.removeEventListener('change', applyTheme);
  }, [theme]);
  useEffect(() => {
    const update = () => {
      migrateLegacyRoute();
      setRoute(currentRoute());
    };
    update();
    window.addEventListener('popstate', update);
    window.addEventListener('hashchange', update);
    return () => {
      window.removeEventListener('popstate', update);
      window.removeEventListener('hashchange', update);
    };
  }, []);
  useEffect(() => {
    const nextSection = route.split(/[/?]/)[0];
    if (nextSection === 'pricing') {
      // The plans sit far down a page whose serif faces load after first paint,
      // so the target moves. Position after the fonts settle, and place the
      // section directly rather than animating two thousand pixels to reach it.
      // `instant` is required: styles.css sets scroll-behavior: smooth on the
      // document, and an animated scroll gets retargeted by the reflow.
      let cancelled = false;
      const scrollToPlans = () => {
        if (!cancelled)
          document
            .getElementById('pricing')
            ?.scrollIntoView({ block: 'start', behavior: 'instant' });
      };
      window.requestAnimationFrame(scrollToPlans);
      document.fonts?.ready.then(scrollToPlans).catch(() => {});
      return () => {
        cancelled = true;
      };
    }
    window.requestAnimationFrame(() => {
      if (nextSection !== 'docs') window.scrollTo({ top: 0, behavior: 'instant' });
    });
  }, [route]);
  useEffect(() => {
    let cancelled = false;
    loadCurrentUser()
      .then((user) => {
        if (!cancelled) {
          setUser(user);
          setAuthPending(false);
          rememberSession(Boolean(user));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
          setAuthPending(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [loadCurrentUser]);
  useEffect(() => {
    if (user) void loadCreditUtilizationChart();
  }, [user]);
  const logout = async () => {
    await logoutBrowser();
    setUser(null);
    rememberSession(false);
    if (section === 'app') navigateTo('/');
  };
  const accountDeleted = () => {
    setUser(null);
    setAuthPending(false);
    rememberSession(false);
    navigateTo('/');
  };
  const path = route;
  const directShare = window.location.pathname.match(/^\/s\/([^/]+)\/?$/);
  const directTraceId = directShare ? decodeURIComponent(directShare[1]) : null;
  const routePath = path.split('?')[0];
  const [requestedSection, requestedPage] = routePath.split('/');
  const section = ['dashboard', 'account'].includes(requestedSection) ? 'app' : requestedSection;
  const page =
    requestedSection === 'dashboard' && requestedPage === 'credits' ? 'usage' : requestedPage;
  const routeQuery = path.includes('?') ? `?${path.split('?').slice(1).join('?')}` : '';
  const canonicalPath = `${section}${page ? `/${page}` : ''}${routeQuery}`;
  const sectionAnchor = new URLSearchParams(path.split('?')[1] || '').get('section');
  const isPublicTraces = section === 'traces';
  const accountLoading = section === 'app' && authPending;
  const placeholderVisible = useSettledWait(accountLoading);
  useEffect(() => {
    const titles: Record<string, string> = {
      authorize: 'Connect device',
      app: 'Dashboard',
      docs: 'Docs',
      registry: 'Registry',
      pricing: 'Pricing',
      privacy: 'Privacy',
      signin: 'Sign in',
      terms: 'Terms',
      traces: 'Traces',
      verify: 'Verify',
    };
    const accountTitle =
      page === 'traces'
        ? 'Traces'
        : page === 'usage'
          ? 'Usage'
          : page === 'settings'
            ? 'Settings'
            : 'Overview';
    const sectionTitle = section === 'app' ? accountTitle : titles[section];
    document.title = directTraceId
      ? 'Shared trace · Exalto Seal'
      : sectionTitle
        ? `${sectionTitle} · Exalto Seal`
        : 'Exalto Seal';
  }, [directTraceId, page, section]);
  return (
    <>
      <Header
        user={user}
        onLogout={logout}
        hideSignIn={section === 'authorize' || section === 'signin'}
        authPending={authPending}
      />
      {directTraceId ? (
        <PublicTracePage traceId={directTraceId} />
      ) : section === 'authorize' ? (
        <DeviceAuthorizationApproval route={path} user={user} />
      ) : section === 'signin' ? (
        <SignInPage route={path} user={user} />
      ) : section === 'verify' ? (
        <VerificationPage />
      ) : section === 'docs' ? (
        <Docs pageKey={page || 'overview'} section={sectionAnchor ?? undefined} />
      ) : isPublicTraces ? (
        <PublicTraces />
      ) : section === 'registry' ? (
        <RegistryPage />
      ) : section === 'pricing' ? (
        <LandingPage />
      ) : !section ? (
        <LandingPage />
      ) : accountLoading ? (
        placeholderVisible && <AccountPlaceholder />
      ) : section === 'app' && user ? (
        <Dashboard
          user={user}
          view={page}
          route={path}
          theme={theme}
          onThemeChange={setTheme}
          onAccountDeleted={accountDeleted}
        />
      ) : section === 'app' ? (
        <SignInPage
          route={`signin?return_to=${encodeURIComponent(`/${canonicalPath}`)}`}
          user={null}
        />
      ) : isLegalPage(section) ? (
        <LegalPage pageKey={section} />
      ) : (
        <SignInPage route="signin" user={user} />
      )}
      {!isPublicTraces && !accountLoading && <Footer />}
    </>
  );
}
