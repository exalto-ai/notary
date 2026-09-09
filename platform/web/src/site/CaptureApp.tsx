import type { MouseEvent as ReactMouseEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { AuthProviderIcon } from '../AuthProviderIcon';
import { initialThemePreference, resolvedTheme } from '../theme';
import './siteStyles';
import { apiHref, getAuthProviders, getCurrentUser, logoutBrowser } from '../platform-api/client';
import { Dashboard } from './AccountDashboard';
import { DeviceAuthorizationApproval } from './AuthorizationPages';
import { AccountPlaceholder, useSettledWait } from './LoadingStates';
import { currentRoute, navigateTo } from './navigation';
import { websiteHref } from './origins';
import { Docs } from './PublicDocs';
import { Footer, isLegalPage, LegalPage } from './SharedShell';
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
      <a className="app-brand" href="/" aria-label="Exalto Capture home">
        <span>Capture</span>
        <small>BY EXALTO</small>
      </a>
      <nav className="app-nav-links" aria-label="Product">
        <a href="/docs">Docs</a>
        <a href={websiteHref('/')}>Exalto ↗</a>
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
    requestedReturn?.startsWith('/app/')
      ? requestedReturn
      : null;
  const providerHref = (provider: AuthProvider) =>
    apiHref(`/api/auth/${provider}${returnTo ? `?return_to=${encodeURIComponent(returnTo)}` : ''}`);
  if (user)
    return (
      <main className="app-sign-in">
        <section className="app-sign-in-panel">
          <span className="app-kicker">EXALTO CAPTURE</span>
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
        <span className="app-kicker">EXALTO CAPTURE · YOUR WORKSPACE</span>
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

export function CaptureApp({
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
  const routePath = path.split('?')[0];
  const [requestedSection, requestedPage] = routePath.split('/');
  const section = requestedSection || 'app';
  const page = requestedPage;
  const routeQuery = path.includes('?') ? `?${path.split('?').slice(1).join('?')}` : '';
  const canonicalPath = `${section}${page ? `/${page}` : ''}${routeQuery}`;
  const sectionAnchor = new URLSearchParams(path.split('?')[1] || '').get('section');
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
    document.title = sectionTitle ? `${sectionTitle} · Exalto Capture` : 'Exalto Capture';
  }, [page, section]);
  return (
    <>
      <Header
        user={user}
        onLogout={logout}
        hideSignIn={section === 'authorize' || section === 'signin'}
        authPending={authPending}
      />
      {section === 'authorize' ? (
        <DeviceAuthorizationApproval route={path} user={user} />
      ) : section === 'signin' ? (
        <SignInPage route={path} user={user} />
      ) : section === 'docs' ? (
        <Docs pageKey={page || 'overview'} section={sectionAnchor ?? undefined} />
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
        <main className="legal-shell">
          <h1>Page not found</h1>
          <a href="/">Open Capture</a>
        </main>
      )}
      {!accountLoading && <Footer />}
    </>
  );
}
