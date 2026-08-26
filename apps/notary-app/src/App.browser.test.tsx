import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import App from './App';
import { createDisposableTestMarker } from './Onboarding';
import { formatBytes } from './product';

function renderApp(query: string) {
  window.history.replaceState({}, '', `/${query}`);
  return render(<App />);
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  window.history.replaceState({}, '', '/');
});

describe('Exalto Capture desktop shell', () => {
  test('exposes three product destinations and the Trace Catalogue', async () => {
    renderApp('?screen=capture-on');
    await expect
      .poll(() =>
        Array.from(document.querySelectorAll('.sidebar-group button')).map((node) =>
          node.textContent?.replace(/\d+$/, ''),
        ),
      )
      .toEqual(['Capture', 'Traces', 'Settings']);
    await expect.element(page.getByText('Captures', { exact: true })).not.toBeInTheDocument();
    await expect.element(page.getByText('Finalizations', { exact: true })).not.toBeInTheDocument();
    await expect.element(page.getByText('Share', { exact: true })).not.toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: /Traces/ })).toBeVisible();
    await expect.element(page.getByRole('button', { name: /Trace Catalogue/ })).toBeVisible();
  });

  test('formats an empty byte balance consistently', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  test('creates a fresh bounded marker for disposable trace confirmation', () => {
    const first = createDisposableTestMarker();
    const second = createDisposableTestMarker();
    expect(first).toMatch(/^EXALTO-CAPTURE-TEST-[0-9A-F]{24}$/);
    expect(second).toMatch(/^EXALTO-CAPTURE-TEST-[0-9A-F]{24}$/);
    expect(second).not.toBe(first);
  });

  test('routes every Capture count to Traces with a visible constraint', async () => {
    renderApp('?screen=capture-on');
    const expected = [
      ['Captured', 'state=captured'],
      ['Sealing', 'status=notarizing'],
      ['Sealed', 'state=notarized'],
      ['Needs attention', 'status=needs_attention'],
    ] as const;

    for (const [label, constraint] of expected) {
      await userEvent.click(page.getByRole('button', { name: new RegExp(label) }));
      await expect
        .poll(() => document.querySelector<HTMLIFrameElement>('.workspace-frame iframe')?.src)
        .toContain(`#/traces?${constraint}`);
      await userEvent.click(page.getByRole('button', { name: 'Capture' }));
    }
  });

  test('keeps service-backed workspaces inside the desktop shell', async () => {
    renderApp('?screen=capture-on&view=providers');
    await expect
      .poll(() => document.querySelector<HTMLIFrameElement>('.workspace-frame iframe')?.src)
      .toContain('/dashboard?embedded=desktop#/providers');
    await userEvent.click(page.getByRole('button', { name: 'Connection setup' }));
    await expect.element(page.getByRole('heading', { name: 'Which local tool will you use first?' })).toBeVisible();
    await userEvent.click(page.getByRole('button', { name: 'Done' }));
    await userEvent.click(page.getByRole('button', { name: 'Activity log' }));
    await expect
      .poll(() => document.querySelector<HTMLIFrameElement>('.workspace-frame iframe')?.src)
      .toContain('/dashboard?embedded=desktop#/activity');
  });

  test('keeps the primary capture control on Capture', async () => {
    renderApp('?view=activity');
    await expect.element(page.getByText('Start the local service to inspect private traces and connections. Capture remains off.')).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Start local service' })).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Start capturing' })).not.toBeInTheDocument();
    await userEvent.click(page.getByRole('button', { name: 'Capture' }));
    await expect.element(page.getByRole('button', { name: 'Start capturing' })).toBeVisible();
  });

  test('guides a developer through the six-step Exalto Capture setup', async () => {
    renderApp('?screen=onboarding');
    await expect.element(page.getByRole('heading', { name: 'Set up Exalto Capture' })).toBeVisible();
    expect(document.querySelectorAll('.onboarding-progress span')).toHaveLength(6);
    await expect.element(page.getByText('A trace proves the interaction it contains. It does not prove that omitted interactions never happened.')).toBeVisible();

    await userEvent.click(page.getByRole('button', { name: /Begin setup/ }));
    await expect.element(page.getByRole('heading', { name: 'Protect private traces on this Mac' })).toBeVisible();
    await expect.element(page.getByText(/not protected by the trace vault/)).toBeVisible();
    await userEvent.click(page.getByRole('button', { name: /Protect traces/ }));

    await expect.element(page.getByRole('heading', { name: 'Start with Exalto Seal' })).toBeVisible();
    await userEvent.click(page.getByRole('button', { name: /About compatible notaries/ }));
    await expect.element(page.getByText('Self-hosted notary')).toBeVisible();
    await expect.element(page.getByText('Not configured', { exact: true }).first()).toBeVisible();
    await userEvent.click(page.getByRole('button', { name: /Continue with Exalto Seal/ }));

    await expect.element(page.getByRole('heading', { name: 'Which local tool will you use first?' })).toBeVisible();
    expect(document.body.textContent).toContain('model_provider = "capture-chatgpt"');
    expect(document.body.textContent).toContain('base_url = "http://127.0.0.1:8787/codex"');
    await userEvent.click(page.getByRole('radio', { name: /Claude Code/ }));
    expect(document.body.textContent).toContain('ANTHROPIC_BASE_URL=http://127.0.0.1:8787/anthropic');
    await userEvent.click(page.getByRole('radio', { name: /API or SDK/ }));
    await expect.element(page.getByRole('button', { name: /xAI \/ Grok Not yet supported/ })).toBeDisabled();
    await expect.element(page.getByRole('link', { name: /Open the xAI key guide/ })).toHaveAttribute('href', 'https://docs.x.ai/developers/quickstart');
    await expect.element(page.getByText(/xAI and Grok capture route is not available/)).toBeVisible();
    await expect.element(page.getByRole('link', { name: /Create an OpenAI API key/ })).toHaveAttribute('href', 'https://platform.openai.com/api-keys');
    await expect.element(page.getByRole('radio', { name: /Use scoped local token/ })).toBeChecked();
    const providerKey = page.getByLabelText('OpenAI API key');
    await expect.element(providerKey).toHaveAttribute('type', 'password');
    await expect.element(page.getByRole('button', { name: /Start capture service/ })).toBeDisabled();
    await userEvent.fill(providerKey, 'sk-browser-test-1234');
    await userEvent.click(page.getByRole('button', { name: 'Validate and save' }));
    await expect.element(page.getByText('OpenAI key is ready')).toBeVisible();
    await expect.element(page.getByText('Validated directly with the provider')).toBeVisible();
    await expect.element(page.getByLabelText('Replace OpenAI key')).toHaveValue('');
    await userEvent.click(page.getByRole('button', { name: 'Copy local token' }));
    await expect.element(page.getByText(/Local access token copied/)).toBeVisible();
    await userEvent.click(page.getByRole('radio', { name: /Send provider key/ }));
    await expect.element(page.getByText('OpenAI key is ready')).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Remove' })).toBeVisible();
    await expect.element(page.getByText(/Keychain-managed route is still available/)).toBeVisible();
    await userEvent.click(page.getByRole('radio', { name: /Use scoped local token/ }));
    await userEvent.click(page.getByRole('radio', { name: 'Anthropic' }));
    await expect.element(page.getByText(/Local access token copied/)).not.toBeInTheDocument();
    await userEvent.click(page.getByRole('radio', { name: 'OpenAI' }));

    await userEvent.click(page.getByRole('button', { name: /Start capture service/ }));
    await expect.element(page.getByRole('heading', { name: 'Capture one disposable trace' })).toBeVisible();
    await expect.element(page.getByText(/^Reply with exactly: EXALTO-CAPTURE-TEST-[0-9A-F]{24}$/)).toBeVisible();
    expect(document.body.textContent).toContain('$OPENAI_API_KEY');
    await expect.element(page.getByRole('button', { name: 'Check for new trace' })).toBeVisible();
    await userEvent.click(page.getByRole('button', { name: 'Skip test' }));

    await expect.element(page.getByRole('heading', { name: 'Exalto Capture is ready' })).toBeVisible();
    await expect.element(page.getByText(/Local capture does not require an Exalto account/)).toBeVisible();
    await expect.element(page.getByRole('button', { name: /Open Capture/ })).toBeVisible();
  });

  test('uses private Trace language in the locked state', async () => {
    renderApp('?screen=unlock');
    await expect.element(page.getByText('Private trace vault')).toBeVisible();
    await expect.element(page.getByRole('heading', { name: 'Unlock private traces on this Mac' })).toBeVisible();
  });

  test('uses one embedded desktop-and-service Settings surface', async () => {
    renderApp('?screen=capture-on&view=settings&update=ready');
    await expect
      .poll(() => document.querySelector<HTMLIFrameElement>('.embedded-settings-page iframe')?.src)
      .toContain('/dashboard?embedded=desktop#/settings');
    expect(document.querySelectorAll('.embedded-settings-page iframe')).toHaveLength(1);
    await expect.element(page.getByText('Menu-bar controller', { exact: true })).not.toBeInTheDocument();
    await expect.element(page.getByRole('heading', { name: 'Service settings' })).not.toBeInTheDocument();
    const frame = document.querySelector<HTMLIFrameElement>('.embedded-settings-page iframe');
    if (!frame?.contentWindow) throw new Error('Settings frame is missing');
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'http://127.0.0.1:8788',
        source: frame.contentWindow,
        data: {
          type: 'notary:desktop-settings-action',
          payload: { action: 'set_launch_at_login', enabled: true },
        },
      }),
    );
    await expect.poll(() => localStorage.getItem('notary-launch-at-login')).toBe('true');
  });

  test('keeps simplified Settings groups available without the capture control', async () => {
    renderApp('?screen=offline&view=settings');
    await expect
      .poll(() =>
        Array.from(document.querySelectorAll('.preference-section > h2')).map(
          (heading) => heading.textContent,
        ),
      )
      .toEqual(['Connections', 'Privacy & storage', 'App', 'Advanced']);
    await expect.element(page.getByRole('switch', { name: 'Capture new requests' })).not.toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: 'Start capturing' })).not.toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: 'Start local service' })).toBeVisible();
  });
});
