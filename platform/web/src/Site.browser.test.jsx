import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import CreditUtilizationChart from './CreditUtilizationChart';
import { ProviderIdentity } from './ProviderIdentity';
import { fetchLatestMacosDownload } from './site/release';
import {
  AccountSettings,
  ApiKeysPanel,
  App,
  Dashboard,
  DeleteAccountPanel,
  DeviceAuthorizationApproval,
  Footer,
  Header,
  SignInPage,
} from './site/SiteApp';
import { initialThemePreference } from './theme';

afterEach(async () => {
  cleanup();
  document.querySelectorAll('[data-test-metadata]').forEach((element) => {
    element.remove();
  });
  window.history.replaceState({}, '', '/');
  window.localStorage.removeItem('notary-theme');
  window.localStorage.removeItem('notary-session');
  await page.viewport(1280, 900);
});
const balanceFixture = (remaining = 1_024) => ({
  included_monthly_remaining_bytes: remaining,
  supplemental_remaining_bytes: 0,
  total_granted_bytes: remaining,
  total_remaining_bytes: remaining,
  total_used_bytes: 0,
  next_grant_expiration: null,
});
const creditsFixture = (remaining = 1_024) => ({
  capture: balanceFixture(remaining),
  notarization: balanceFixture(remaining),
  reset_at: 4_102_444_800,
});
const billingFixture = (overrides = {}) => ({
  plan: 'free',
  billing_status: 'active',
  purchase_mode: 'disabled',
  subscriptions_configured: false,
  entitlements: {
    monthly_capture_bytes: 50_000_000,
    monthly_notarization_bytes: 50_000_000,
    trace_storage_bytes: 1_000_000_000,
  },
  ...overrides,
});
const usageFixture = ({
  credits = creditsFixture(),
  captures = 0,
  notarizations = 0,
  total = 0,
  shared = 0,
  verifying = 0,
  storedBytes = 0,
} = {}) => ({
  credits,
  operations: { captures, notarizations },
  hosted_traces: { total, shared, verifying, needs_attention: 0, stored_bytes: storedBytes },
});
test('serves the canonical Seal guide without sign-in', async () => {
  window.history.replaceState({}, '', '/docs/trace-packages');
  render(<App loadCurrentUser={async () => null} />);

  await expect.element(page.getByRole('heading', { name: 'Seal and verify' })).toBeVisible();
  await expect
    .element(page.getByText('Exalto Seal is not a notary public.', { exact: false }))
    .toBeVisible();
});

test('preserves the requested dashboard page through sign-in', async () => {
  render(
    <SignInPage
      route="signin?return_to=%2Fapp%2Ftraces"
      loadProviders={async () => ({ google: true, github: true })}
    />,
  );
  await expect
    .element(page.getByRole('link', { name: 'Continue with Google' }))
    .toHaveAttribute('href', 'https://api.exalto.ai/api/auth/google?return_to=%2Fapp%2Ftraces');
});

test('uses the app navigation and keeps only legal links in the footer', async () => {
  render(
    <>
      <Header user={null} onLogout={() => {}} />
      <Footer />
    </>,
  );

  const productNav = document.querySelector('.app-nav-links');
  await expect
    .element(page.getByRole('link', { name: 'Exalto Capture home' }))
    .toHaveAttribute('href', '/');
  expect(document.querySelector('.app-brand > span')?.textContent).toBe('Capture');
  expect(document.querySelector('.app-brand > small')?.textContent).toBe('BY EXALTO');
  expect(document.querySelector('.footer-copyright')?.textContent.trim()).toBe('Exalto');
  expect(Array.from(productNav.querySelectorAll('a'), (link) => link.textContent)).toEqual([
    'Docs',
    'Exalto ↗',
  ]);
  await expect.element(page.getByRole('link', { name: 'Docs' })).toHaveAttribute('href', '/docs');
  await expect
    .element(page.getByRole('banner').getByRole('link', { name: 'Exalto ↗' }))
    .toHaveAttribute('href', 'https://exalto.ai/');
  await expect
    .element(page.getByRole('link', { name: 'Sign in' }))
    .toHaveAttribute('href', '/signin');
  await expect
    .element(page.getByRole('contentinfo').getByRole('link', { name: 'Exalto', exact: true }))
    .toHaveAttribute('href', 'https://exalto.ai');
  expect(
    Array.from(document.querySelectorAll('.app-footer nav a'), (link) => link.textContent),
  ).toEqual(['Privacy', 'Terms']);
  await expect
    .element(page.getByRole('banner').getByRole('link', { name: 'Docs' }))
    .toHaveAttribute('href', '/docs');
});

test('keeps Docs and Seal visible on narrow screens for either sign-in state', async () => {
  await page.viewport(320, 700);
  for (const user of [null, { provider_display_name: 'fixture-user' }]) {
    render(<Header user={user} onLogout={() => {}} />);
    const header = page.getByRole('banner');
    await expect.element(header.getByRole('link', { name: 'Docs' })).toBeVisible();
    await expect.element(header.getByRole('link', { name: 'Exalto ↗' })).toBeVisible();
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
    cleanup();
  }
});

test('uses the endorsed identity in browser titles', async () => {
  window.history.replaceState({}, '', '/privacy');
  render(<App loadCurrentUser={async () => null} />);

  await expect.element(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible();
  expect(window.location.pathname).toBe('/privacy');
  expect(window.location.hash).toBe('');
  expect(document.title).toBe('Privacy · Exalto Capture');
});

test('defaults to light and keeps appearance choices out of the signed-in account menu', async () => {
  expect(initialThemePreference()).toBe('light');
  let signedOut = false;
  render(
    <Header
      user={{ provider_display_name: 'fixture-user' }}
      onLogout={() => {
        signedOut = true;
      }}
    />,
  );

  await page.getByRole('button', { name: 'Account menu for fixture-user' }).click();
  await expect.element(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  expect(signedOut).toBe(true);
  await expect.element(page.getByRole('group', { name: 'Appearance' })).not.toBeInTheDocument();
});

test('reserves the account slot while browser authentication is loading', async () => {
  render(<Header user={null} authPending onLogout={() => {}} />);

  await expect.element(page.getByRole('status', { name: 'Checking sign-in status' })).toBeVisible();
  await expect.element(page.getByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
});

test('holds the Account layout with a placeholder while authentication loads', async () => {
  window.history.replaceState({}, '', '/app/settings');
  let resolveCurrentUser;
  const loadCurrentUser = () =>
    new Promise((resolve) => {
      resolveCurrentUser = resolve;
    });
  render(<App loadCurrentUser={loadCurrentUser} />);

  const placeholder = page.getByRole('status', { name: 'Loading dashboard' });
  await expect.element(placeholder).toBeVisible();
  // The placeholder is the Account layout, not an indicator floating over it.
  expect(document.querySelector('.dashboard-shell--placeholder .dashboard-layout')).not.toBe(null);
  await expect
    .element(page.getByRole('heading', { name: 'Record every session.' }))
    .not.toBeInTheDocument();

  resolveCurrentUser({
    provider_display_name: 'fixture-user',
    usage: usageFixture(),
  });
  await expect.element(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  expect(document.title).toBe('Settings · Exalto Capture');
  expect(window.location.pathname).toBe('/app/settings');
});

test('offers Google first and preserves a local-service return route', async () => {
  render(
    <SignInPage
      route="signin?return_to=%2Fauthorize%3Frequest_id%3Drequest-123"
      loadProviders={async () => ({ google: true, github: true })}
    />,
  );

  const google = page.getByRole('link', { name: 'Continue with Google' });
  await expect.element(google).toBeVisible();
  await expect
    .element(google)
    .toHaveAttribute(
      'href',
      'https://api.exalto.ai/api/auth/google?return_to=%2Fauthorize%3Frequest_id%3Drequest-123',
    );
  await expect.element(page.getByRole('link', { name: 'Continue with GitHub' })).toBeVisible();
  expect(document.querySelectorAll('[data-auth-provider-icon]')).toHaveLength(2);
  expect(document.querySelector('[data-auth-provider-icon="google"]')).not.toBeNull();
  expect(document.querySelector('[data-auth-provider-icon="github"]')).not.toBeNull();
  expect(document.querySelector('.auth-provider')?.textContent).toContain('Google');
  await expect.element(page.getByText('Google access')).not.toBeInTheDocument();
  await expect.element(page.getByText('Provider tokens')).not.toBeInTheDocument();
});

test('resolves the macOS download from the release pointer and manifest', async () => {
  const build = 'runtime-v9.9.9-abc-1';
  const responses = {
    'https://notary-prod-downloads.t3.tigrisfiles.io/releases/latest': {
      ok: true,
      text: async () => `${build} 9.9.9\n`,
    },
    [`https://notary-prod-downloads.t3.tigrisfiles.io/releases/builds/${build}/release.json`]: {
      ok: true,
      json: async () => ({
        version: '9.9.9',
        desktop: {
          'darwin-aarch64': {
            dmg: { name: 'Exalto-Capture-macos-arm64.dmg', size_bytes: 24_500_000 },
          },
        },
      }),
    },
  };

  expect(await fetchLatestMacosDownload(async (url) => responses[url])).toEqual({
    url: `https://notary-prod-downloads.t3.tigrisfiles.io/releases/builds/${build}/Exalto-Capture-macos-arm64.dmg`,
    version: '9.9.9',
    sizeBytes: 24_500_000,
  });
  // A pointer that names a path rather than a build identifier is never followed.
  expect(
    await fetchLatestMacosDownload(async () => ({ ok: true, text: async () => '../evil 9.9.9' })),
  ).toBe(null);
  expect(await fetchLatestMacosDownload(async () => ({ ok: false }))).toBe(null);
});

test('returns signed-out Account visitors to the requested Account route', async () => {
  render(
    <SignInPage
      route="signin?return_to=%2Fapp%2Ftraces"
      loadProviders={async () => ({ google: true, github: true })}
    />,
  );
  await expect
    .element(page.getByRole('link', { name: 'Continue with Google' }))
    .toHaveAttribute('href', 'https://api.exalto.ai/api/auth/google?return_to=%2Fapp%2Ftraces');
});

test('shows only the configured sign-in provider', async () => {
  render(<SignInPage loadProviders={async () => ({ google: false, github: true })} />);

  await expect.element(page.getByRole('link', { name: 'Continue with GitHub' })).toBeVisible();
  await expect
    .element(page.getByRole('link', { name: 'Continue with Google' }))
    .not.toBeInTheDocument();
  expect(document.querySelectorAll('[data-auth-provider-icon="github"]')).toHaveLength(1);
});

test('shows progress while handing off to an auth provider', async () => {
  render(<SignInPage loadProviders={async () => ({ google: true, github: true })} />);

  const google = page.getByRole('link', { name: 'Continue with Google' });
  await expect.element(google).toBeVisible();
  google.element().addEventListener('click', (event) => event.preventDefault());
  await google.click();

  await expect
    .element(page.getByRole('link', { name: 'Connecting to Google…' }))
    .toHaveAttribute('aria-busy', 'true');
  await expect
    .element(page.getByRole('link', { name: 'Continue with GitHub' }))
    .toHaveAttribute('aria-disabled', 'true');
  expect(document.querySelectorAll('.auth-provider-progress i')).toHaveLength(3);
});

test('covers sign-in loading, unavailable, and already-signed-in states', async () => {
  render(<SignInPage loadProviders={() => new Promise(() => {})} />);
  await expect.element(page.getByRole('status').getByText('Loading sign-in options')).toBeVisible();
  await expect
    .element(page.getByText('Sign in to manage Capture, Sealed Traces, and your account.'))
    .toBeVisible();

  cleanup();
  render(
    <SignInPage
      loadProviders={async () => {
        throw new Error('Identity providers are offline.');
      }}
    />,
  );
  await expect
    .element(page.getByRole('alert').getByText('Sign-in options are unavailable'))
    .toBeVisible();
  await expect.element(page.getByText('Identity providers are offline.')).toBeVisible();

  cleanup();
  render(
    <SignInPage
      user={{ provider_display_name: 'fixture-user' }}
      loadProviders={async () => ({ google: true, github: true })}
    />,
  );
  await expect.element(page.getByRole('heading', { name: 'You’re already here.' })).toBeVisible();
  await expect
    .element(page.getByRole('link', { name: /Open dashboard/ }))
    .toHaveAttribute('href', '/app/');
});

test('offers Auto, Light, and Dark in Account appearance settings', async () => {
  let selectedTheme;
  render(
    <AccountSettings
      theme="light"
      onThemeChange={(theme) => {
        selectedTheme = theme;
      }}
    />,
  );

  await expect.element(page.getByRole('heading', { name: 'Appearance' })).toBeVisible();
  const appearance = page.getByRole('radiogroup', { name: 'Appearance' });
  await expect
    .element(appearance.getByRole('radio', { name: 'light' }))
    .toHaveAttribute('aria-checked', 'true');
  await appearance.getByRole('radio', { name: 'auto' }).click();
  expect(selectedTheme).toBe('auto');
  await expect.element(appearance.getByRole('radio', { name: 'dark' })).toBeVisible();
});

test('collapses Account navigation into a mobile dropdown', async () => {
  await page.viewport(390, 844);
  render(
    <Dashboard
      user={{
        provider_display_name: 'fixture-user',
        usage: usageFixture({ credits: null, total: 3, shared: 2, verifying: 1 }),
      }}
      view="usage"
      theme="light"
      onThemeChange={() => {}}
      onAccountDeleted={() => {}}
      loadConnectedDevices={async () => ({ items: [], next_cursor: null })}
      loadHostedTraces={async () => ({ items: [], next_cursor: null })}
      loadCreditOffers={async () => []}
      loadCreditHistory={async () => ({ items: [], next_cursor: null })}
      loadBillingPurchases={async () => []}
    />,
  );

  const navigation = page.getByRole('navigation', { name: 'Account navigation' });
  const trigger = navigation.getByRole('button', { name: 'Account menu: Usage' });
  await expect.element(trigger).toHaveAttribute('aria-expanded', 'false');
  await trigger.click();
  await expect.element(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect.element(navigation.getByRole('link', { name: /^Traces\s*3$/ })).toBeVisible();
  await expect
    .element(navigation.getByRole('link', { name: 'Usage' }))
    .toHaveAttribute('aria-current', 'page');
  fireEvent.keyDown(window, { key: 'Escape' });
  await expect.element(trigger).toHaveAttribute('aria-expanded', 'false');
});

test('uses only the canonical Account routes in desktop navigation', async () => {
  render(
    <Dashboard
      user={{
        provider_display_name: 'fixture-user',
        usage: usageFixture({ total: 3, shared: 2, verifying: 1 }),
      }}
      view="traces"
      theme="light"
      onThemeChange={() => {}}
      onAccountDeleted={() => {}}
      loadConnectedDevices={async () => ({ items: [], next_cursor: null })}
      loadHostedTraces={async () => ({ items: [], next_cursor: null })}
      loadCreditOffers={async () => []}
      loadCreditHistory={async () => ({ items: [], next_cursor: null })}
      loadBillingPurchases={async () => []}
    />,
  );

  const accountRoutes = Array.from(document.querySelectorAll('.dashboard-sidebar a')).map(
    (link) => [link.textContent?.trim(), link.getAttribute('href')],
  );
  expect(accountRoutes).toEqual([
    ['Overview', '/app/overview'],
    ['Traces3', '/app/traces'],
    ['Usage', '/app/usage'],
    ['Settings', '/app/settings'],
  ]);
  expect(document.querySelector('a[href^="/dashboard"]')).toBeNull();
});

test('summarizes plan, usage, shared traces, and attention in the Account overview', async () => {
  render(
    <Dashboard
      user={{
        provider_display_name: 'fixture-user',
        usage: usageFixture({
          captures: 12,
          notarizations: 7,
          total: 3,
          shared: 2,
          verifying: 1,
        }),
      }}
      view="overview"
      theme="light"
      onThemeChange={() => {}}
      onAccountDeleted={() => {}}
      loadConnectedDevices={async () => ({ items: [], next_cursor: null })}
      loadHostedTraces={async () => ({ items: [], next_cursor: null })}
      loadCreditOffers={async () => []}
      loadCreditHistory={async () => ({ items: [], next_cursor: null })}
      loadBillingPurchases={async () => []}
    />,
  );

  await expect.element(page.getByText('None', { exact: true })).toBeVisible();
  const summary = document.querySelector('.dashboard-summary');
  expect(summary?.textContent).toContain('Current planFree · active');
  expect(summary?.textContent).toContain('Capture usage0 B used');
  expect(summary?.textContent).toContain('Notarization usage0 B used');
  expect(summary?.textContent).toContain('Shared traces2');
  expect(summary?.textContent).toContain('Needs attentionNone');
  expect(summary?.textContent).not.toContain('Completed captures');
  expect(summary?.textContent).not.toContain('Completed notarizations');
});

test('discards an old credit-history page after claiming an offer', async () => {
  let rootRequests = 0;
  let resolveOldPage;
  let markOldPageStarted;
  const oldPageStarted = new Promise((resolve) => {
    markOldPageStarted = resolve;
  });
  const entry = (id, label, createdAt) => ({
    id,
    kind: 'grant',
    credit_kind: 'notarization',
    amount_bytes: 1_024,
    display_label: label,
    created_at: createdAt,
  });
  const loadCreditHistory = async (options) => {
    if (options.cursor) {
      markOldPageStarted();
      return new Promise((resolve) => {
        resolveOldPage = resolve;
      });
    }
    rootRequests += 1;
    return rootRequests === 1
      ? { items: [entry('initial', 'Initial credit', 100)], next_cursor: 'old-cursor' }
      : {
          items: [entry('claimed', 'Claimed credit', 200), entry('initial', 'Initial credit', 100)],
          next_cursor: 'fresh-cursor',
        };
  };
  render(
    <Dashboard
      user={{
        provider_display_name: 'fixture-user',
        billing: billingFixture(),
        usage: usageFixture(),
      }}
      view="usage"
      theme="light"
      onThemeChange={() => {}}
      onAccountDeleted={() => {}}
      loadConnectedDevices={async () => ({ items: [], next_cursor: null })}
      loadHostedTraces={async () => ({ items: [], next_cursor: null })}
      loadCreditOffers={async () => [
        {
          id: 'offer-1',
          title: 'Test credit',
          description: 'One-time test credit.',
          amount_bytes: 1_024,
          claim_expires_at: 4_102_444_800,
          credit_expires_at: 4_102_444_800,
        },
      ]}
      loadCreditHistory={loadCreditHistory}
      loadBillingPurchases={async () => []}
      claimOfferRequest={async () => ({ credits: creditsFixture(2_048) })}
    />,
  );

  await expect.element(page.getByText('Initial credit')).toBeVisible();
  await page.getByRole('button', { name: 'Load older activity' }).click();
  await oldPageStarted;
  await page.getByRole('button', { name: /^Claim / }).click();
  await expect.element(page.getByText('Claimed credit')).toBeVisible();

  resolveOldPage({
    items: [entry('stale', 'Stale older credit', 50)],
    next_cursor: 'stale-cursor',
  });
  await new Promise((resolve) => window.setTimeout(resolve, 0));
  await expect.element(page.getByText('Stale older credit')).not.toBeInTheDocument();
  await expect.element(page.getByText('Claimed credit')).toBeVisible();
});

test('starts a fixed-price Stripe Checkout from the credit quantity rail', async () => {
  let checkoutRequest;
  let checkoutUrl;
  render(
    <Dashboard
      user={{
        provider_display_name: 'fixture-user',
        billing: billingFixture({ purchase_mode: 'live' }),
        usage: usageFixture(),
      }}
      view="usage"
      theme="light"
      onThemeChange={() => {}}
      onAccountDeleted={() => {}}
      loadConnectedDevices={async () => ({ items: [], next_cursor: null })}
      loadHostedTraces={async () => ({ items: [], next_cursor: null })}
      loadCreditOffers={async () => []}
      loadCreditHistory={async () => ({ items: [], next_cursor: null })}
      loadBillingPurchases={async () => []}
      startCheckout={async (quantityGb, idempotencyKey) => {
        checkoutRequest = { quantityGb, idempotencyKey };
        return { checkout_url: 'https://checkout.stripe.com/c/pay/test' };
      }}
      openCheckout={(url) => {
        checkoutUrl = url;
      }}
    />,
  );

  await page.getByRole('button', { name: '10 GB', exact: true }).click();
  await page.getByRole('button', { name: 'Buy 10 GB for $100' }).click();
  expect(checkoutRequest.quantityGb).toBe(10);
  expect(checkoutRequest.idempotencyKey).toMatch(/^[a-zA-Z0-9_-]+$/);
  expect(checkoutUrl).toBe('https://checkout.stripe.com/c/pay/test');
});

test('opens subscription Checkout for free accounts and the billing portal for subscribers', async () => {
  let checkoutRequest;
  let openedUrl;
  const common = {
    view: 'usage',
    theme: 'light',
    onThemeChange: () => {},
    onAccountDeleted: () => {},
    loadConnectedDevices: async () => ({ items: [], next_cursor: null }),
    loadHostedTraces: async () => ({ items: [], next_cursor: null }),
    loadCreditOffers: async () => [],
    loadCreditHistory: async () => ({ items: [], next_cursor: null }),
    loadBillingPurchases: async () => [],
    openCheckout: (url) => {
      openedUrl = url;
    },
  };
  render(
    <Dashboard
      {...common}
      user={{
        provider_display_name: 'fixture-user',
        billing: billingFixture({ purchase_mode: 'live', subscriptions_configured: true }),
        usage: usageFixture({ credits: creditsFixture(50_000_000) }),
      }}
      startSubscriptionCheckout={async (plan, idempotencyKey) => {
        checkoutRequest = { plan, idempotencyKey };
        return { checkout_url: 'https://checkout.stripe.com/c/pay/subscription' };
      }}
    />,
  );

  expect(document.body.textContent).toContain('50.0 MB');
  expect(document.body.textContent).toContain('of 1.0 GB');
  expect(document.body.textContent).not.toContain('47.7 MB');
  await page.getByRole('button', { name: '1 GB · $9.99/month' }).click();
  expect(checkoutRequest.plan).toBe('one_gb');
  expect(checkoutRequest.idempotencyKey).toMatch(/^[a-zA-Z0-9_-]+$/);
  expect(openedUrl).toBe('https://checkout.stripe.com/c/pay/subscription');

  cleanup();
  render(
    <Dashboard
      {...common}
      user={{
        provider_display_name: 'fixture-user',
        billing: billingFixture({ plan: 'one_gb', purchase_mode: 'live' }),
        usage: usageFixture(),
      }}
      startBillingPortal={async () => ({
        portal_url: 'https://billing.stripe.com/p/session/test',
      })}
    />,
  );
  await page.getByRole('button', { name: 'Manage subscription' }).click();
  expect(openedUrl).toBe('https://billing.stripe.com/p/session/test');
});

test('hides Checkout when disabled and labels Stripe test mode unmistakably', async () => {
  const credits = creditsFixture();
  const common = {
    view: 'usage',
    theme: 'light',
    onThemeChange: () => {},
    onAccountDeleted: () => {},
    loadConnectedDevices: async () => ({ items: [], next_cursor: null }),
    loadHostedTraces: async () => ({ items: [], next_cursor: null }),
    loadCreditOffers: async () => [],
    loadCreditHistory: async () => ({ items: [], next_cursor: null }),
    loadBillingPurchases: async () => [],
  };
  render(
    <Dashboard
      {...common}
      user={{
        provider_display_name: 'fixture-user',
        billing: billingFixture(),
        usage: usageFixture({ credits }),
      }}
    />,
  );
  await expect.element(page.getByRole('heading', { name: 'Purchases unavailable' })).toBeVisible();
  await expect.element(page.getByText('You can’t buy more notarization right now.')).toBeVisible();
  await expect
    .element(page.getByRole('group', { name: 'Credit quantity' }))
    .not.toBeInTheDocument();

  cleanup();
  render(
    <Dashboard
      {...common}
      user={{
        provider_display_name: 'fixture-user',
        billing: billingFixture({ purchase_mode: 'test' }),
        usage: usageFixture({ credits }),
      }}
    />,
  );
  await expect.element(page.getByText('Stripe test mode · no real charges')).toBeVisible();
  await expect
    .element(page.getByRole('button', { name: 'Open test Checkout · 1 GB for $10' }))
    .toBeVisible();
  await expect
    .element(page.getByText('New subscriptions are temporarily unavailable.'))
    .toBeVisible();
  await expect.element(page.getByRole('button', { name: '1 GB · $9.99/month' })).toBeDisabled();
});

test('retries Checkout confirmation and keeps a fresher purchase than the initial list', async () => {
  const credits = creditsFixture();
  let resolveInitialList;
  let pollCalls = 0;
  const purchase = (state) => ({
    id: 'purchase-1',
    state,
    quantity_gb: 1,
    amount_cents: 1_000,
    created_at: 1_786_000_000,
  });
  render(
    <Dashboard
      user={{
        provider_display_name: 'fixture-user',
        billing: billingFixture({ purchase_mode: 'test' }),
        usage: usageFixture({ credits }),
      }}
      view="usage"
      route="usage?checkout=success&purchase_id=purchase-1"
      theme="light"
      onThemeChange={() => {}}
      onAccountDeleted={() => {}}
      loadConnectedDevices={async () => ({ items: [], next_cursor: null })}
      loadHostedTraces={async () => ({ items: [], next_cursor: null })}
      loadCreditOffers={async () => []}
      loadCreditHistory={async () => ({ items: [], next_cursor: null })}
      loadBillingPurchases={() =>
        new Promise((resolve) => {
          resolveInitialList = resolve;
        })
      }
      loadBillingPurchase={async () => {
        pollCalls += 1;
        if (pollCalls === 1) throw new Error('temporary network failure');
        return purchase(pollCalls === 2 ? 'checkout_open' : 'paid');
      }}
      loadCurrentUser={async () => ({
        billing: billingFixture({ plan: 'one_gb', purchase_mode: 'test' }),
        usage: usageFixture({ credits }),
      })}
      checkoutPollBaseDelay={0}
      checkoutPollMaxAttempts={4}
    />,
  );

  await expect.element(page.getByText('Payment confirmed. Your credits are ready.')).toBeVisible();
  resolveInitialList([purchase('checkout_open')]);
  await new Promise((resolve) => window.setTimeout(resolve, 0));
  await expect.element(page.getByText('paid', { exact: true })).toBeVisible();
  await expect.element(page.getByText('checkout open', { exact: true })).not.toBeInTheDocument();
  expect(pollCalls).toBe(3);
});

test('shows a bounded timeout when Stripe confirmation stays nonterminal', async () => {
  const credits = creditsFixture();
  render(
    <Dashboard
      user={{
        provider_display_name: 'fixture-user',
        billing: billingFixture({ purchase_mode: 'test' }),
        usage: usageFixture({ credits }),
      }}
      view="usage"
      route="usage?checkout=success&purchase_id=purchase-1"
      theme="light"
      onThemeChange={() => {}}
      onAccountDeleted={() => {}}
      loadConnectedDevices={async () => ({ items: [], next_cursor: null })}
      loadHostedTraces={async () => ({ items: [], next_cursor: null })}
      loadCreditOffers={async () => []}
      loadCreditHistory={async () => ({ items: [], next_cursor: null })}
      loadBillingPurchases={async () => []}
      loadBillingPurchase={async () => ({
        id: 'purchase-1',
        state: 'checkout_open',
        quantity_gb: 1,
        amount_cents: 1_000,
        created_at: 1_786_000_000,
      })}
      checkoutPollBaseDelay={0}
      checkoutPollMaxAttempts={2}
    />,
  );

  await expect
    .element(
      page.getByText(
        'We could not confirm the payment yet. Check purchase history or refresh this page.',
      ),
    )
    .toBeVisible();
});

test('renders every known provider icon and neutral fallbacks beside provider text', async () => {
  render(
    <div>
      {['openai', 'anthropic', 'deepseek', 'openrouter', 'future-provider'].map((provider) => (
        <ProviderIdentity provider={provider} key={provider} />
      ))}
      <ProviderIdentity provider={null} />
    </div>,
  );

  for (const provider of ['openai', 'anthropic', 'deepseek', 'openrouter']) {
    expect(document.querySelector(`[data-provider-icon="${provider}"]`)).not.toBeNull();
    await expect.element(page.getByText(provider, { exact: true })).toBeVisible();
  }
  expect(document.querySelectorAll('[data-provider-icon="unknown"]')).toHaveLength(2);
  await expect.element(page.getByText('future-provider')).toBeVisible();
  await expect.element(page.getByText('Provider not reported')).toBeVisible();
  expect(document.querySelectorAll('[data-provider-icon] [aria-hidden="true"]')).toHaveLength(6);
});

test('makes local service authorization a clear two-step decision', async () => {
  window.location.hash = '#/authorize?request_id=request-123&approval_secret=secret-456';
  render(
    <>
      <Header user={null} hideSignIn />
      <DeviceAuthorizationApproval
        route="authorize?request_id=request-123&approval_secret=secret-456"
        user={null}
      />
    </>,
  );

  await expect.element(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible();
  await expect.element(page.getByRole('link', { name: 'Choose sign-in method' })).toBeVisible();
  await expect.element(page.getByText('Google access')).not.toBeInTheDocument();
  await expect.element(page.getByText('Provider tokens')).not.toBeInTheDocument();
  await expect.element(page.getByText('Review and connect the device')).toBeVisible();
  await expect.element(page.getByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
});

test('shows the device, account, and code before approval', async () => {
  const loadApproval = async () => ({
    device_name: 'Research MacBook',
    user_code: '7A3C-91F2',
    expires_at: 1_786_000_000,
    capabilities: ['hosted_notarization', 'consume_credits', 'share_notarized_traces'],
  });
  let approved;
  render(
    <DeviceAuthorizationApproval
      route="authorize?request_id=request-123&approval_secret=secret-456"
      user={{ provider_display_name: 'fixture-user' }}
      loadApproval={loadApproval}
      approveRequest={async (...args) => {
        approved = args;
      }}
    />,
  );

  await expect.element(page.getByRole('heading', { name: 'Connect this device?' })).toBeVisible();
  await expect.element(page.getByText('Research MacBook')).toBeVisible();
  await expect.element(page.getByText('fixture-user')).toBeVisible();
  await expect.element(page.getByText('7A3C-91F2')).toBeVisible();
  await expect.element(page.getByText('Use hosted notarization')).toBeVisible();
  await expect.element(page.getByText('Consume account credits')).toBeVisible();
  await expect.element(page.getByText('Share sealed traces')).toBeVisible();
  await expect
    .element(page.getByText(/Connecting does not upload existing local traces/))
    .toBeVisible();
  expect(document.body.textContent).not.toContain('secret-456');
  await page.getByRole('button', { name: 'Connect device' }).click();

  expect(approved).toEqual(['request-123', 'secret-456']);
  await expect.element(page.getByRole('heading', { name: 'Device connected' })).toBeVisible();
});

test('covers checking, invalid, and unavailable device-connection states', async () => {
  render(
    <DeviceAuthorizationApproval
      route="authorize?request_id=request-123&approval_secret=secret-456"
      user={{ provider_display_name: 'fixture-user' }}
      loadApproval={() => new Promise(() => {})}
    />,
  );
  await expect.element(page.getByRole('heading', { name: 'Checking this request' })).toBeVisible();
  await expect.element(page.getByText('None until you approve')).toBeVisible();

  cleanup();
  render(
    <DeviceAuthorizationApproval
      route="authorize"
      user={{ provider_display_name: 'fixture-user' }}
    />,
  );
  await expect
    .element(page.getByRole('heading', { name: 'Invalid authorization link' }))
    .toBeVisible();
  await expect.element(page.getByText('Restart the connection from Exalto Capture')).toBeVisible();

  cleanup();
  render(
    <DeviceAuthorizationApproval
      route="authorize?request_id=request-123&approval_secret=secret-456"
      user={{ provider_display_name: 'fixture-user' }}
      loadApproval={async () => {
        throw new Error('This request expired.');
      }}
    />,
  );
  await expect.element(page.getByRole('heading', { name: 'Connection unavailable' })).toBeVisible();
  await expect.element(page.getByRole('alert').getByText(/This request expired/)).toBeVisible();
});

test('groups Account settings and revokes a connected device', async () => {
  let revokedId;
  render(
    <Dashboard
      user={{ provider_display_name: 'fixture-user', usage: usageFixture({ credits: null }) }}
      view="settings"
      theme="light"
      onThemeChange={() => {}}
      onAccountDeleted={() => {}}
      loadConnectedDevices={async () => ({
        items: [
          {
            device_id: 'device-1',
            device_name: 'Research MacBook',
            created_at: 1_786_000_000,
            last_used_at: 1_786_000_100,
            expires_at: 1_796_000_000,
            revoked_at: null,
          },
        ],
        next_cursor: null,
      })}
      revokeDeviceRequest={async (id) => {
        revokedId = id;
      }}
      loadHostedTraces={async () => ({ items: [], next_cursor: null })}
      loadCreditOffers={async () => []}
      loadCreditHistory={async () => ({ items: [], next_cursor: null })}
      loadBillingPurchases={async () => []}
    />,
  );

  await expect.element(page.getByRole('heading', { name: 'Appearance' })).toBeVisible();
  await expect.element(page.getByRole('heading', { name: 'API access' })).toBeVisible();
  await expect.element(page.getByRole('heading', { name: 'Connected devices' })).toBeVisible();
  await expect.element(page.getByRole('heading', { name: 'Delete account' })).toBeVisible();
  await expect.element(page.getByText('Research MacBook')).toBeVisible();
  await page.getByRole('button', { name: 'Revoke' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Revoke device' }).click();
  expect(revokedId).toBe('device-1');
  await expect.element(page.getByText('No devices are connected.')).toBeVisible();
});

test('shows a new API key once and revokes it from the account list', async () => {
  const secret = `notary_key_${'a'.repeat(32)}_${'b'.repeat(64)}`;
  let createRequest;
  let revokedId;
  render(
    <ApiKeysPanel
      loadKeys={async () => ({ items: [], next_cursor: null })}
      createKey={async (request) => {
        createRequest = request;
        return {
          secret,
          api_key: {
            id: 'a'.repeat(32),
            prefix: `notary_key_${'a'.repeat(12)}`,
            name: request.name,
            scopes: request.scopes,
            created_at: 1_786_000_000,
            last_used_at: null,
            expires_at: request.expires_at,
            revoked_at: null,
          },
        };
      }}
      revokeKey={async (id) => {
        revokedId = id;
      }}
    />,
  );

  await expect.element(page.getByText('No API keys')).toBeVisible();
  await page.getByRole('button', { name: 'Create API key' }).click();
  await page.getByLabelText('Name').fill('Nightly CI');
  await page.getByRole('dialog').getByRole('button', { name: 'Create API key' }).click();

  await expect.element(page.getByText(secret)).toBeVisible();
  expect(createRequest.name).toBe('Nightly CI');
  expect(createRequest.scopes).toEqual([
    'account:read',
    'traces:read',
    'traces:share',
    'capture:request',
    'notarization:request',
  ]);
  await page.getByRole('button', { name: 'I stored the key' }).click();
  await expect.element(page.getByText(secret)).not.toBeInTheDocument();
  await expect.element(page.getByText('Nightly CI')).toBeVisible();

  await page.getByRole('button', { name: 'Revoke' }).click();
  await page.getByRole('button', { name: 'Revoke API key' }).click();
  expect(revokedId).toBe('a'.repeat(32));
  await expect.element(page.getByText('Revoked')).toBeVisible();
});

test('loads older API keys without replacing the current page', async () => {
  const key = (id, name) => ({
    id,
    prefix: `notary_key_${id.slice(0, 12)}`,
    name,
    scopes: ['account:read'],
    created_at: 1_786_000_000,
    last_used_at: null,
    expires_at: null,
    revoked_at: null,
  });
  const requests = [];
  render(
    <ApiKeysPanel
      loadKeys={async (options) => {
        requests.push(options);
        return options.cursor
          ? { items: [key('b'.repeat(32), 'Older key')], next_cursor: null }
          : { items: [key('a'.repeat(32), 'Current key')], next_cursor: 'next-key-page' };
      }}
      createKey={async () => {
        throw new Error('not used');
      }}
      revokeKey={async () => {}}
    />,
  );

  await expect.element(page.getByText('Current key')).toBeVisible();
  await page.getByRole('button', { name: 'Load more API keys' }).click();
  await expect.element(page.getByText('Older key')).toBeVisible();
  await expect.element(page.getByText('Current key')).toBeVisible();
  expect(requests.at(-1)).toEqual({ limit: 20, cursor: 'next-key-page' });
});

test('requires the account identifier before deleting an account', async () => {
  let deleted = false;
  let completed = false;
  render(
    <DeleteAccountPanel
      identifier="fixture-user"
      deleteAccount={async () => {
        deleted = true;
      }}
      onDeleted={() => {
        completed = true;
      }}
    />,
  );

  await expect
    .element(page.getByText(/Local traces and local settings on your devices are not deleted/))
    .toBeVisible();
  await page.getByRole('button', { name: 'Delete account' }).click();
  const dialog = page.getByRole('alertdialog');
  const submit = dialog.getByRole('button', { name: 'Delete account' });
  await expect.element(submit).toBeDisabled();
  await dialog.getByLabelText('Type fixture-user to confirm.').fill('fixture-user');
  await expect.element(submit).toBeEnabled();
  await submit.click();
  await new Promise((resolve) => window.requestAnimationFrame(resolve));
  expect(deleted).toBe(true);
  expect(completed).toBe(true);
});

test('manages access and unpublishes an admitted trace from the account', async () => {
  let current = {
    trace_id: 'share-managed',
    source_trace_id: 'local-trace-managed',
    status: 'shared',
    access: {
      visibility: 'listed',
      password_protected: false,
      expires_at: null,
    },
    allow_high_entropy: false,
    created_at: 1_786_000_000,
    updated_at: 1_786_000_000,
    verification: {
      verified_at: 1_786_000_000,
      failure_code: null,
    },
    package: {
      format: 'notary/trace-package/v1',
      declared_size_bytes: 4096,
      declared_sha256: 'a'.repeat(64),
      admitted_size_bytes: 4096,
      admitted_sha256: 'a'.repeat(64),
    },
    status_url: '/api/traces/share-managed',
    public_url: 'https://example.test/s/share-managed',
    package_url: '/package.llmtrace',
    owner_package_url: '/api/traces/share-managed/package.llmtrace',
  };
  const updates = [];
  let stopped = false;
  render(
    <Dashboard
      user={{
        provider_display_name: 'fixture-user',
        usage: usageFixture({ credits: null, total: 1, shared: 1 }),
      }}
      view="traces"
      theme="light"
      onThemeChange={() => {}}
      onAccountDeleted={() => {}}
      loadConnectedDevices={async () => ({ items: [], next_cursor: null })}
      loadHostedTraces={async () => ({ items: [current], next_cursor: null })}
      loadCreditOffers={async () => []}
      loadCreditHistory={async () => ({ items: [], next_cursor: null })}
      loadBillingPurchases={async () => []}
      updateTraceRequest={async (_id, settings) => {
        updates.push(settings);
        current = {
          ...current,
          access: {
            ...current.access,
            visibility: settings.visibility ?? current.access.visibility,
            password_protected: settings.password ? true : current.access.password_protected,
          },
        };
        return current;
      }}
      stopSharingRequest={async () => {
        stopped = true;
        current = { ...current, status: 'stopped', public_url: null };
      }}
    />,
  );

  await expect
    .element(page.getByText('Sealed traces you’ve shared through Exalto Seal.'))
    .toBeVisible();
  await expect.element(page.getByRole('link', { name: 'Open' })).toBeVisible();
  await expect.element(page.getByRole('button', { name: 'Copy link' })).toBeVisible();
  await expect
    .element(page.getByRole('link', { name: 'Export .llmtrace' }))
    .toHaveAttribute('href', 'https://api.exalto.ai/api/traces/share-managed/package.llmtrace');
  await page.getByRole('button', { name: 'Manage access' }).click();
  const dialogBounds = page.getByRole('dialog').element().getBoundingClientRect();
  const visibilityWidth = page
    .getByRole('combobox', { name: 'Public discovery' })
    .element()
    .getBoundingClientRect().width;
  expect(visibilityWidth).toBeGreaterThan(dialogBounds.width * 0.8);
  expect(Math.abs(dialogBounds.left + dialogBounds.width / 2 - window.innerWidth / 2)).toBeLessThan(
    1,
  );
  expect(
    Math.abs(dialogBounds.top + dialogBounds.height / 2 - window.innerHeight / 2),
  ).toBeLessThan(1);
  await page.viewport(390, 844);
  const mobileDialogBounds = page.getByRole('dialog').element().getBoundingClientRect();
  expect(
    Math.abs(mobileDialogBounds.left + mobileDialogBounds.width / 2 - window.innerWidth / 2),
  ).toBeLessThan(1);
  expect(
    Math.abs(mobileDialogBounds.top + mobileDialogBounds.height / 2 - window.innerHeight / 2),
  ).toBeLessThan(1);
  expect(mobileDialogBounds.left).toBeGreaterThanOrEqual(16);
  expect(mobileDialogBounds.right).toBeLessThanOrEqual(window.innerWidth - 16);
  await page.getByRole('checkbox', { name: /Require a password/ }).click();
  await page.getByRole('textbox', { name: 'Password' }).fill('eight-characters');
  await page.getByRole('button', { name: 'Save changes' }).click();
  expect(updates[0]).toEqual({ visibility: 'listed', password: 'eight-characters' });

  await page.getByRole('button', { name: 'Stop sharing' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Stop sharing' }).click();
  expect(stopped).toBe(true);
  await expect.element(page.getByText('Stopped', { exact: true })).toBeVisible();
  await expect
    .element(page.getByRole('link', { name: 'Export .llmtrace' }))
    .toHaveAttribute('href', 'https://api.exalto.ai/api/traces/share-managed/package.llmtrace');
});

test('renders every canonical hosted Trace status', async () => {
  const trace = (status, index) => ({
    trace_id: `trace-${status}`,
    source_trace_id: `local-${status}`,
    status,
    access: { visibility: 'unlisted', password_protected: false, expires_at: null },
    allow_high_entropy: false,
    created_at: 1_786_000_000 + index,
    updated_at: 1_786_000_000 + index,
    verification: {
      verified_at: null,
      failure_code: status === 'failed' ? 'worker_failed' : null,
    },
    package: {
      format: 'notary/trace-package/v1',
      declared_size_bytes: 4096,
      declared_sha256: `${index}`.repeat(64),
      admitted_size_bytes: null,
      admitted_sha256: null,
    },
    status_url: `/api/traces/trace-${status}`,
    public_url: status === 'shared' ? `https://example.test/s/trace-${status}` : null,
    package_url: status === 'shared' ? `/api/traces/trace-${status}/package.llmtrace` : null,
  });
  const statuses = ['verifying', 'shared', 'stopped', 'rejected', 'failed'];
  render(
    <Dashboard
      user={{
        provider_display_name: 'fixture-user',
        usage: usageFixture({ credits: null, total: statuses.length, shared: 2, verifying: 1 }),
      }}
      view="traces"
      theme="light"
      onThemeChange={() => {}}
      onAccountDeleted={() => {}}
      loadConnectedDevices={async () => ({ items: [], next_cursor: null })}
      loadHostedTraces={async () => ({
        items: statuses.map(trace),
        next_cursor: null,
      })}
      loadCreditOffers={async () => []}
      loadCreditHistory={async () => ({ items: [], next_cursor: null })}
      loadBillingPurchases={async () => []}
    />,
  );

  for (const status of ['Verifying', 'Shared', 'Stopped', 'Rejected', 'Failed']) {
    await expect.element(page.getByText(status, { exact: true })).toBeVisible();
  }
});

test('renders 30 days of utilization in decimal MB with an accessible summary and overall budget', async () => {
  const today = Date.now() / 1000;
  render(
    <CreditUtilizationChart
      credits={{
        notarization: { total_remaining_bytes: 500_000_000, total_granted_bytes: 750_000_000 },
      }}
      formatBytes={(bytes) => `${bytes / 1_000_000} MB`}
      historyDebits={[
        {
          id: 'd1',
          kind: 'debit',
          amount_bytes: 1_000_000,
          display_label: 'Capture A',
          created_at: today,
        },
        {
          id: 'd2',
          kind: 'debit',
          amount_bytes: 250_000,
          display_label: 'Capture B',
          created_at: today - 86400,
        },
      ]}
    />,
  );

  await expect.element(page.getByRole('heading', { name: 'Last 30 days' })).toBeVisible();
  await expect
    .element(page.getByRole('img', { name: /Daily utilization in MB.*Total 1.25 MB/i }))
    .toBeVisible();
  await expect.element(page.getByText('750 MB')).toBeVisible();
  expect(document.querySelector('.recharts-bar-rectangle path')?.getAttribute('fill')).toBe(
    'var(--action)',
  );
  expect(document.querySelectorAll('.recharts-bar-rectangle')).toHaveLength(2);
});

test('distinguishes loading, zero-usage, and unavailable utilization states', async () => {
  const props = {
    credits: {
      notarization: { total_remaining_bytes: 500_000_000, total_granted_bytes: 750_000_000 },
    },
    formatBytes: (bytes) => `${bytes / 1_000_000} MB`,
  };
  const rendered = render(<CreditUtilizationChart {...props} historyDebits={null} />);
  await expect
    .element(page.getByRole('status', { name: 'Loading daily utilization' }))
    .toBeVisible();

  rendered.rerender(<CreditUtilizationChart {...props} historyDebits={[]} />);
  await expect
    .element(page.getByRole('status').getByText('No utilization in the last 30 days'))
    .toBeVisible();

  rendered.rerender(<CreditUtilizationChart {...props} historyDebits={[]} historyError />);
  await expect
    .element(page.getByRole('alert').getByText('Daily utilization unavailable'))
    .toBeVisible();
});

test('Capture opens sign-in at root without a duplicate landing page', async () => {
  render(<App loadCurrentUser={async () => null} />);
  await expect.element(page.getByRole('heading', { name: 'Keep the record close.' })).toBeVisible();
  expect(document.title).toBe('Overview · Exalto Capture');
});
