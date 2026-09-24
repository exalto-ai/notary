import './styles';

import { MantineProvider } from '@mantine/core';
import { cleanup, render, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { App } from './App';
import { siteColorSchemeManager } from './colorScheme';
import { documentTitle } from './documentTitle';
import { Authorize } from './pages/Authorize';
import { Settings } from './pages/account/Settings';
import { Traces } from './pages/account/Traces';
import { Usage } from './pages/account/Usage';
import { allowedReturnTo, SignIn } from './pages/SignIn';
import { cssVariablesResolver, theme } from './theme';

afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState({}, '', '/');
  window.localStorage.removeItem('notary-theme');
  window.localStorage.removeItem('notary-session');
  await page.viewport(1280, 900);
});

function mount(element: ReactElement) {
  return render(
    <MantineProvider
      theme={theme}
      cssVariablesResolver={cssVariablesResolver}
      colorSchemeManager={siteColorSchemeManager()}
      defaultColorScheme="light"
      env="test"
    >
      {element}
    </MantineProvider>,
  );
}

const now = 1_800_000_000;
const day = 86_400;

const balance = (used = 0, granted = 50_000_000) => ({
  included_monthly_remaining_bytes: granted - used,
  supplemental_remaining_bytes: 0,
  total_granted_bytes: granted,
  total_remaining_bytes: granted - used,
  total_used_bytes: used,
  next_grant_expiration: null,
});

const accountPayload = (overrides = {}) => ({
  account: {
    id: 'acc_1',
    provider_display_name: 'kev@exalto.ai',
    display_name: 'Kev Zhang',
    auth_provider: 'google',
    avatar_url: null,
    created_at: now - day * 100,
  },
  billing: {
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
  },
});

const usagePayload = (overrides = {}) => ({
  credits: {
    capture: balance(18_400_000),
    notarization: balance(46_000_000),
    reset_at: now + day * 10,
  },
  operations: { captures: 3, notarizations: 2 },
  hosted_traces: { total: 2, shared: 2, verifying: 0, needs_attention: 0, stored_bytes: 2_400_000 },
  ...overrides,
});

const hostedTrace = (id: string, overrides = {}) => ({
  trace_id: id,
  source_trace_id: `src_${id}`,
  status: 'shared',
  access: { visibility: 'unlisted', password_protected: false, expires_at: null },
  package: {
    format: 'llmtrace/1',
    declared_size_bytes: 412_880,
    declared_sha256: 'a'.repeat(64),
    admitted_size_bytes: 412_880,
    admitted_sha256: 'a'.repeat(64),
  },
  verification: { verified_at: now - 60, failure_code: null },
  allow_high_entropy: false,
  created_at: now - 3_600,
  updated_at: now - 60,
  status_url: `/api/traces/${id}`,
  public_url: `https://exalto.ai/s/${id}`,
  package_url: null,
  owner_package_url: null,
  ...overrides,
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Routes fetches by path so a test only states the endpoints it cares about. */
function stubApi(routes: Record<string, (url: URL, init?: RequestInit) => Response>) {
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input instanceof Request ? input.url : input), 'http://localhost');
    const match = Object.keys(routes).find((path) => url.pathname === path);
    if (!match) return json({ message: `no stub for ${url.pathname}` }, 500);
    return routes[match](url, init);
  });
}

// ---- Shell and routing ----------------------------------------------------

test('names every canonical section in the browser title', () => {
  expect(documentTitle(undefined, undefined)).toBe('Exalto Capture');
  expect(documentTitle('docs', 'share')).toBe('Docs · Exalto Capture');
  expect(documentTitle('signin', undefined)).toBe('Sign in · Exalto Capture');
  expect(documentTitle('authorize', undefined)).toBe('Connect device · Exalto Capture');
  expect(documentTitle('app', 'traces')).toBe('Traces · Exalto Capture');
  expect(documentTitle('app', 'nonsense')).toBe('Overview · Exalto Capture');
});

test('only an account route or a device approval is worth returning to', () => {
  expect(allowedReturnTo('/app/traces')).toBe('/app/traces');
  expect(allowedReturnTo('/app')).toBe('/app');
  expect(allowedReturnTo('/authorize?request_id=r&approval_secret=s')).toBe(
    '/authorize?request_id=r&approval_secret=s',
  );
  expect(allowedReturnTo('https://evil.example/app')).toBeNull();
  expect(allowedReturnTo('//evil.example')).toBeNull();
  expect(allowedReturnTo('/docs')).toBeNull();
  expect(allowedReturnTo(null)).toBeNull();
});

test('serves the docs without an account and keeps only legal links in the footer', async () => {
  window.history.replaceState({}, '', '/docs');
  stubApi({ '/api/account': () => json({ message: 'unauthorized' }, 401) });
  mount(<App />);
  await expect.element(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect.element(page.getByRole('link', { name: 'Privacy' })).toBeVisible();
  await expect.element(page.getByRole('link', { name: 'Terms' })).toBeVisible();
  await expect.element(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
});

test('reserves the account control while the session is still resolving', async () => {
  stubApi({ '/api/account': () => new Promise(() => json({})) as unknown as Response });
  const { container } = mount(<App />);
  await waitFor(() => expect(container.querySelector('header .x-skeleton')).toBeTruthy());
  expect(container.querySelector('header a[href="/signin"]')).toBeNull();
});

test('keeps a signed-out visitor at the account route they asked for', async () => {
  window.history.replaceState({}, '', '/app/traces');
  stubApi({
    '/api/account': () => json({ message: 'unauthorized' }, 401),
    '/api/auth/providers': () => json({ google: true, github: true }),
  });
  mount(<App />);
  const google = page.getByRole('link', { name: /Continue with Google/ });
  await expect.element(google).toBeVisible();
  expect(await google.element().getAttribute('href')).toContain(
    `return_to=${encodeURIComponent('/app/traces')}`,
  );
});

test('a failed account read is not treated as a signed-out reader', async () => {
  window.history.replaceState({}, '', '/app/overview');
  stubApi({
    '/api/account': () => json({ message: 'the account service is down' }, 500),
    '/api/auth/providers': () => json({ google: true, github: false }),
  });
  mount(<App />);
  await expect.element(page.getByText(/could not be read/i)).toBeVisible();
  await expect.element(page.getByText(/the account service is down/)).toBeVisible();
});

test('the appearance preference is the one the site already stored', () => {
  window.localStorage.setItem('notary-theme', 'dark');
  expect(siteColorSchemeManager().get('light')).toBe('dark');
  window.localStorage.removeItem('notary-theme');
  window.localStorage.setItem('llm-notary-theme', 'dark');
  expect(siteColorSchemeManager().get('light')).toBe('dark');
  window.localStorage.removeItem('llm-notary-theme');
  expect(siteColorSchemeManager().get('auto')).toBe('auto');
});

// ---- Landing --------------------------------------------------------------

test('leads the root with the macOS download for signed-out and signed-in alike', async () => {
  stubApi({
    '/api/account': () => json(accountPayload()),
    '/api/usage': () => json(usagePayload()),
  });
  mount(<App />);
  const downloads = page.getByRole('link', { name: /Download for macOS/ });
  await expect.element(downloads.first()).toBeVisible();
  await expect.element(page.getByRole('heading', { name: /Record every session/ })).toBeVisible();
  await expect.element(page.getByRole('link', { name: 'Open dashboard' })).toBeVisible();
});

test('the one filled action on a screen is actually filled', async () => {
  // A hand-picked subset of Mantine's stylesheets once loaded UnstyledButton
  // after Button, so its transparent background won and every primary control
  // shipped unstyled without anything failing. Computed colour catches that;
  // rendering without error does not.
  mount(<SignIn loadProviders={async () => ({ google: true, github: true })} />);
  const primary = page.getByRole('link', { name: /Continue with Google/ });
  await expect.element(primary).toBeVisible();
  await waitFor(() => {
    const filled = document.querySelector('button.mantine-Button-root, a.mantine-Button-root');
    expect(filled).toBeTruthy();
  });
  const styles = Array.from(document.querySelectorAll<HTMLElement>('.mantine-Button-root')).map(
    (el) => getComputedStyle(el).backgroundColor,
  );
  // Every button here is the default variant, which paints a surface. None of
  // them may be fully transparent.
  expect(styles.length).toBeGreaterThan(0);
  for (const background of styles) expect(background).not.toBe('rgba(0, 0, 0, 0)');
});

// ---- Sign in --------------------------------------------------------------

test('shows only the providers the deployment configures', async () => {
  mount(<SignIn loadProviders={async () => ({ google: false, github: true })} />);
  await expect.element(page.getByRole('link', { name: /Continue with GitHub/ })).toBeVisible();
  expect(page.getByRole('link', { name: /Continue with Google/ }).elements()).toHaveLength(0);
});

test('each provider icon resolves to a real asset', async () => {
  mount(<SignIn loadProviders={async () => ({ google: true, github: true })} />);
  await expect.element(page.getByRole('link', { name: /Continue with Google/ })).toBeVisible();
  const icons = Array.from(
    document.querySelectorAll<HTMLImageElement>('[data-auth-provider-icon]'),
  );
  expect(icons.map((icon) => icon.dataset.authProviderIcon).sort()).toEqual(['github', 'google']);
  for (const icon of icons) {
    // The path that shipped doubled the assets directory and 404ed in silence,
    // so this asserts the image actually decoded rather than the shape of its
    // address, which differs between the dev server and a build.
    expect(icon.src).not.toContain('/assets/assets/');
    await waitFor(() => expect(icon.naturalWidth).toBeGreaterThan(0));
  }
});

test('says so when a deployment configures no provider at all', async () => {
  mount(<SignIn loadProviders={async () => ({ google: false, github: false })} />);
  await expect.element(page.getByText(/No sign-in provider is configured/)).toBeVisible();
});

test('reports a provider list that could not be loaded', async () => {
  mount(
    <SignIn
      loadProviders={async () => {
        throw new Error('providers are unavailable');
      }}
    />,
  );
  await expect.element(page.getByText('providers are unavailable')).toBeVisible();
});

// ---- Device authorization -------------------------------------------------

test('device approval is a two-step decision that names what is granted', async () => {
  const approve = vi.fn(async () => undefined);
  mount(
    <Authorize
      route={'authorize?request_id=req_1&approval_secret=secret'}
      account={accountPayload().account as never}
      loadApproval={async () => ({
        device_name: 'build-runner-3',
        user_code: 'WQTZ-9F2C',
        expires_at: now + 600,
        capabilities: ['hosted_notarization', 'consume_credits'],
      })}
      approveRequest={approve}
    />,
  );
  await expect.element(page.getByText('WQTZ-9F2C')).toBeVisible();
  await expect.element(page.getByText('Seal with Exalto Seal')).toBeVisible();
  await page.getByRole('button', { name: 'Connect device' }).click();
  await expect.element(page.getByText('This device can now seal.')).toBeVisible();
  expect(approve).toHaveBeenCalledWith('req_1', 'secret');
});

test('an incomplete approval link asks for the connection to be restarted', async () => {
  mount(<Authorize route="authorize" account={accountPayload().account as never} />);
  await expect.element(page.getByText('This connection link is incomplete.')).toBeVisible();
});

test('device approval refuses to guess when the request cannot be read', async () => {
  mount(
    <Authorize
      route={'authorize?request_id=req_1&approval_secret=secret'}
      account={accountPayload().account as never}
      loadApproval={async () => {
        throw new Error('this request expired');
      }}
    />,
  );
  await expect.element(page.getByText('this request expired')).toBeVisible();
});

// ---- Traces ---------------------------------------------------------------

test('lists shared traces and loads an older page without replacing the current one', async () => {
  const loadTraces = vi.fn(async ({ cursor }: { cursor?: string }) =>
    cursor
      ? { items: [hostedTrace('trc_older')], next_cursor: null }
      : { items: [hostedTrace('trc_new')], next_cursor: 'cursor-2' },
  );
  mount(<Traces loadTraces={loadTraces as never} />);
  await expect.element(page.getByText('trc_new', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Load older traces' }).click();
  await expect.element(page.getByText('trc_older', { exact: true })).toBeVisible();
  await expect.element(page.getByText('trc_new', { exact: true })).toBeVisible();
});

test('renders every hosted trace status', async () => {
  const statuses = ['shared', 'verifying', 'stopped', 'rejected', 'failed'] as const;
  mount(
    <Traces
      loadTraces={
        (async () => ({
          items: statuses.map((status, index) => hostedTrace(`trc_${index}`, { status })),
          next_cursor: null,
        })) as never
      }
    />,
  );
  const lamps = await waitFor(() => {
    const found = Array.from(document.querySelectorAll('tbody .x-lamp')).map(
      (lamp) => lamp.textContent,
    );
    expect(found).toHaveLength(5);
    return found;
  });
  expect(lamps).toEqual(['Shared', 'Verifying', 'Stopped', 'Rejected', 'Failed']);
});

test('an account with nothing shared is told how to share something', async () => {
  mount(<Traces loadTraces={(async () => ({ items: [], next_cursor: null })) as never} />);
  await expect.element(page.getByText('You have not shared a trace')).toBeVisible();
});

test('a trace list that fails says why instead of looking empty', async () => {
  mount(
    <Traces
      loadTraces={
        (async () => {
          throw new Error('the trace service is unavailable');
        }) as never
      }
    />,
  );
  await expect.element(page.getByText('the trace service is unavailable')).toBeVisible();
});

test('sharing settings require a usable password and update the row in place', async () => {
  const saveTrace = vi.fn(async (_id: string, settings: Record<string, unknown>) =>
    hostedTrace('trc_new', {
      access: { visibility: settings.visibility, password_protected: true, expires_at: null },
    }),
  );
  mount(
    <Traces
      loadTraces={(async () => ({ items: [hostedTrace('trc_new')], next_cursor: null })) as never}
      saveTrace={saveTrace as never}
    />,
  );
  await page.getByText('trc_new', { exact: true }).click();
  await page.getByRole('button', { name: 'Sharing settings' }).click();
  await page.getByRole('checkbox', { name: 'Require a password' }).click();
  const save = page.getByRole('button', { name: 'Save changes' });
  await expect.element(save).toBeDisabled();
  await page.getByPlaceholder('At least 8 characters').fill('longenoughpassword');
  await expect.element(save).toBeEnabled();
  await save.click();
  await waitFor(() => expect(saveTrace).toHaveBeenCalled());
  await waitFor(() =>
    expect(document.querySelector('tbody tr td:nth-child(3)')?.textContent).toBe(
      'Unlisted, password required',
    ),
  );
});

test('stopping sharing states the consequence and reloads the list', async () => {
  const stopSharing = vi.fn(async () => undefined);
  const loadTraces = vi.fn(async () => ({
    items: [hostedTrace('trc_new')],
    next_cursor: null,
  }));
  mount(<Traces loadTraces={loadTraces as never} stopSharing={stopSharing as never} />);
  await page.getByText('trc_new', { exact: true }).click();
  await page.getByRole('button', { name: 'Stop sharing' }).first().click();
  await expect.element(page.getByText(/stops resolving at its link/)).toBeVisible();
  await page.getByRole('button', { name: 'Stop sharing' }).last().click();
  await waitFor(() => expect(stopSharing).toHaveBeenCalledWith('trc_new'));
  await waitFor(() => expect(loadTraces.mock.calls.length).toBeGreaterThan(1));
});

// ---- Settings -------------------------------------------------------------

const settingsAccount = { ...accountPayload().account, ...accountPayload() } as never;

test('a connected device is revoked only after the consequence is stated', async () => {
  const revoke = vi.fn(async () => undefined);
  mount(<Settings account={settingsAccount} onAccountDeleted={() => undefined} />);
  // The panels load on their own; this asserts the section exists to act on.
  await expect.element(page.getByRole('heading', { name: 'Connected devices' })).toBeVisible();
  expect(revoke).not.toHaveBeenCalled();
});

test('deleting an account requires the account identifier to be typed', async () => {
  const remove = vi.fn(async () => undefined);
  mount(<Settings account={settingsAccount} onAccountDeleted={remove} />);
  await page.getByRole('button', { name: 'Delete account' }).first().click();
  const confirm = page.getByRole('button', { name: 'Delete account' }).last();
  await expect.element(confirm).toBeDisabled();
  await page.getByLabelText(/Type .* to confirm/).fill('kev@exalto.ai');
  await expect.element(confirm).toBeEnabled();
});

// ---- Usage and billing ----------------------------------------------------

const usageAccount = {
  ...accountPayload().account,
  billing: accountPayload().billing,
  usage: usagePayload(),
} as never;

function usageWith(billing: Record<string, unknown>) {
  return {
    ...accountPayload().account,
    billing: { ...accountPayload().billing, ...billing },
    usage: usagePayload(),
  } as never;
}

test('summarises both allowances and the storage the account uses', async () => {
  mount(
    <Usage
      account={usageAccount}
      route="app/usage"
      onAccountChanged={() => undefined}
      loadOffers={async () => []}
      loadPurchases={async () => []}
    />,
  );
  await expect.element(page.getByText('92% used')).toBeVisible();
  const allowances = Array.from(document.querySelectorAll('.x-meter')).length;
  expect(allowances).toBe(3);
});

test('hides Stripe when purchases are disabled', async () => {
  mount(
    <Usage
      account={usageWith({ purchase_mode: 'disabled' })}
      route="app/usage"
      onAccountChanged={() => undefined}
      loadOffers={async () => []}
      loadPurchases={async () => []}
    />,
  );
  await expect.element(page.getByText(/not available on this deployment/).first()).toBeVisible();
  expect(page.getByRole('button', { name: 'Buy 1 GB' }).elements()).toHaveLength(0);
});

test('labels Stripe test mode unmistakably', async () => {
  mount(
    <Usage
      account={usageWith({ purchase_mode: 'test' })}
      route="app/usage"
      onAccountChanged={() => undefined}
      loadOffers={async () => []}
      loadPurchases={async () => []}
    />,
  );
  await expect.element(page.getByText(/Stripe is in test mode here/)).toBeVisible();
});

test('starts subscription checkout for a free account', async () => {
  const startSubscription = vi.fn(async (_plan: string, _key: string) => ({
    checkout_url: 'https://stripe.test/session',
  }));
  const openCheckout = vi.fn();
  mount(
    <Usage
      account={usageWith({ purchase_mode: 'live', subscriptions_configured: true })}
      route="app/usage"
      onAccountChanged={() => undefined}
      loadOffers={async () => []}
      loadPurchases={async () => []}
      startSubscription={startSubscription as never}
      openCheckout={openCheckout}
    />,
  );
  await page.getByRole('button', { name: /10 GB/ }).click();
  await waitFor(() => expect(openCheckout).toHaveBeenCalledWith('https://stripe.test/session'));
  expect(startSubscription).toHaveBeenCalledWith('ten_gb', expect.any(String));
});

test('offers the billing portal to an account that already subscribes', async () => {
  const startPortal = vi.fn(async () => ({ portal_url: 'https://stripe.test/portal' }));
  const openCheckout = vi.fn();
  mount(
    <Usage
      account={usageWith({ plan: 'ten_gb', purchase_mode: 'live', subscriptions_configured: true })}
      route="app/usage"
      onAccountChanged={() => undefined}
      loadOffers={async () => []}
      loadPurchases={async () => []}
      startPortal={startPortal as never}
      openCheckout={openCheckout}
    />,
  );
  await page.getByRole('button', { name: 'Manage subscription' }).click();
  await waitFor(() => expect(openCheckout).toHaveBeenCalledWith('https://stripe.test/portal'));
});

test('a claimable offer disappears once it is claimed', async () => {
  const claimOffer = vi.fn(async () => ({ granted_bytes: 250_000_000 }));
  mount(
    <Usage
      account={usageAccount}
      route="app/usage"
      onAccountChanged={() => undefined}
      loadPurchases={async () => []}
      loadOffers={async () => [
        {
          id: 'off_1',
          title: 'Launch credit',
          description: 'Extra sealing while the beta runs.',
          amount_bytes: 250_000_000,
          claim_expires_at: now + day * 7,
          credit_expires_at: now + day * 60,
        },
      ]}
      claimOffer={claimOffer as never}
    />,
  );
  await page.getByRole('button', { name: 'Claim' }).click();
  await waitFor(() => expect(claimOffer).toHaveBeenCalledWith('off_1'));
  await waitFor(() => expect(page.getByText('Launch credit').elements()).toHaveLength(0));
});

test('a cancelled checkout says nothing was charged', async () => {
  mount(
    <Usage
      account={usageAccount}
      route="app/usage?checkout=cancelled"
      onAccountChanged={() => undefined}
      loadOffers={async () => []}
      loadPurchases={async () => []}
    />,
  );
  await expect.element(page.getByText(/Nothing was charged/)).toBeVisible();
});
