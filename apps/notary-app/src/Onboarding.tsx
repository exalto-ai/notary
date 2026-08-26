import { useEffect, useRef, useState } from 'react';
import {
  BadgeCheck,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  ExternalLink,
  FileCheck2,
  KeyRound,
  LockKeyhole,
  Network,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  SquareTerminal,
} from 'lucide-react';
import {
  completeOnboarding,
  confirmDisposableTrace,
  configureVault,
  copyProviderLocalAccessToken,
  errorMessage,
  getProviderCredentialStatuses,
  getRecentTraceProbes,
  importProviderApiKey,
  openProductLink,
  removeProviderApiKey,
  setCaptureEnabled,
  startDaemon,
  type DesktopState,
  type ProviderCredentialStatus,
} from './bridge';
import { DesktopAccountCard } from './AccountCard';
import { StatusDot, vaultProtection, type View } from './product';
import notaryMark from './notary-mark.svg';
import './onboarding.css';

type OnboardingStep = 'welcome' | 'protection' | 'notary' | 'client' | 'test' | 'account';
type VaultSetupMode = 'keychain' | 'passphrase';
type ClientId = 'codex' | 'claude' | 'api';
type ApiProviderId = 'openai' | 'anthropic' | 'openrouter';
type ApiCredentialMode = 'keychain' | 'external';
type TestStatus = 'idle' | 'checking' | 'not-found' | 'captured';

const onboardingSteps: OnboardingStep[] = [
  'welcome',
  'protection',
  'notary',
  'client',
  'test',
  'account',
];

const clientChoices = [
  {
    id: 'codex',
    name: 'Codex CLI',
    detail: 'Use the ChatGPT sign-in already saved by Codex',
    status: 'Live-tested',
  },
  {
    id: 'claude',
    name: 'Claude Code',
    detail: 'Use the claude.ai sign-in already saved by Claude Code',
    status: 'Live-tested',
  },
  {
    id: 'api',
    name: 'API or SDK',
    detail: 'Import a provider key securely or keep your existing environment',
    status: 'Keychain ready',
  },
] as const;

const apiProviders = [
  {
    id: 'openai',
    name: 'OpenAI',
    environmentVariable: 'OPENAI_API_KEY',
    baseUrl: 'http://127.0.0.1:8787/openai/v1',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyDestination: 'openai_key',
    keyLabel: 'Create an OpenAI API key',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    environmentVariable: 'ANTHROPIC_API_KEY',
    baseUrl: 'http://127.0.0.1:8787/anthropic',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    keyDestination: 'anthropic_key',
    keyLabel: 'Create an Anthropic API key',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    environmentVariable: 'OPENROUTER_API_KEY',
    baseUrl: 'http://127.0.0.1:8787/openrouter/api/v1',
    keyUrl: 'https://openrouter.ai/settings/keys',
    keyDestination: 'openrouter_key',
    keyLabel: 'Create an OpenRouter API key',
  },
] as const;

type ApiProvider = (typeof apiProviders)[number];

const CODEX_CONFIG = `model_provider = "capture-chatgpt"

[model_providers.capture-chatgpt]
name = "Exalto Capture, ChatGPT plan"
base_url = "http://127.0.0.1:8787/codex"
requires_openai_auth = true
wire_api = "responses"
supports_websockets = false`;

const CLAUDE_COMMAND = `env -u ANTHROPIC_API_KEY -u ANTHROPIC_AUTH_TOKEN \\
  ANTHROPIC_BASE_URL=http://127.0.0.1:8787/anthropic \\
  claude`;

const TEST_MARKER_PREFIX = 'EXALTO-CAPTURE-TEST-';

export function createDisposableTestMarker() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `${TEST_MARKER_PREFIX}${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

function expectedTestProvider(client: ClientId, provider: ApiProvider) {
  if (client === 'codex') return 'openai';
  if (client === 'claude') return 'anthropic';
  return provider.id;
}

function testCommand(client: ClientId, provider: ApiProvider, prompt: string) {
  if (client === 'codex') {
    return `codex exec --ephemeral --skip-git-repo-check \\
  '${prompt}'`;
  }
  if (client === 'claude') {
    return `env -u ANTHROPIC_API_KEY -u ANTHROPIC_AUTH_TOKEN \\
  ANTHROPIC_BASE_URL=http://127.0.0.1:8787/anthropic \\
  claude -p '${prompt}'`;
  }
  if (provider.id === 'anthropic') {
    return `curl http://127.0.0.1:8787/anthropic/v1/messages \\
  -H "x-api-key: $ANTHROPIC_API_KEY" \\
  -H 'anthropic-version: 2023-06-01' \\
  -H 'content-type: application/json' \\
  -d '{"model":"YOUR_MODEL","max_tokens":64,"messages":[{"role":"user","content":"${prompt}"}]}'`;
  }
  if (provider.id === 'openrouter') {
    return `curl http://127.0.0.1:8787/openrouter/api/v1/chat/completions \\
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \\
  -H 'content-type: application/json' \\
  -d '{"model":"YOUR_MODEL","messages":[{"role":"user","content":"${prompt}"}]}'`;
  }
  return `curl http://127.0.0.1:8787/openai/v1/responses \\
  -H "Authorization: Bearer $OPENAI_API_KEY" \\
  -H 'content-type: application/json' \\
  -d '{"model":"YOUR_MODEL","input":"${prompt}"}'`;
}

export function Onboarding({ state, refresh, onFinish, initialStep = 'welcome', onCancel }: {
  state: DesktopState;
  refresh: () => Promise<void>;
  onFinish: (view: View) => void;
  initialStep?: OnboardingStep;
  onCancel?: () => void;
}) {
  const [step, setStep] = useState<OnboardingStep>(initialStep);
  const [protectionMode, setProtectionMode] = useState<VaultSetupMode>('keychain');
  const [passphrase, setPassphrase] = useState('');
  const [passphraseConfirmation, setPassphraseConfirmation] = useState('');
  const [client, setClient] = useState<ClientId>('codex');
  const [apiProviderId, setApiProviderId] = useState<ApiProviderId>('openai');
  const [testMarker] = useState(createDisposableTestMarker);
  const [apiCredentialMode, setApiCredentialMode] = useState<ApiCredentialMode>('keychain');
  const [providerCredentials, setProviderCredentials] = useState<ProviderCredentialStatus[]>([]);
  const [credentialBusy, setCredentialBusy] = useState(false);
  const [credentialNotice, setCredentialNotice] = useState<string | null>(null);
  const [testBaseline, setTestBaseline] = useState<ReadonlySet<string> | null>(null);
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiProvider = apiProviders.find((item) => item.id === apiProviderId) ?? apiProviders[0];
  const testPrompt = `Reply with exactly: ${testMarker}`;
  const providerCredential = providerCredentials.find((item) => item.provider === apiProvider.id);
  const managedApiKey = apiCredentialMode === 'keychain' && Boolean(providerCredential?.configured);
  const managedCredentialAvailable = !state.running || state.managed_by_desktop;
  const stepIndex = onboardingSteps.indexOf(step);

  useEffect(() => {
    if (client === 'api' && !managedCredentialAvailable) {
      setCredentialNotice(null);
      setApiCredentialMode('external');
    }
  }, [client, managedCredentialAvailable]);

  useEffect(() => {
    if (step !== 'client' || client !== 'api') return;
    let active = true;
    setCredentialBusy(true);
    void getProviderCredentialStatuses()
      .then((statuses) => {
        if (active) setProviderCredentials(statuses);
      })
      .catch((caught) => {
        if (active) setError(errorMessage(caught));
      })
      .finally(() => {
        if (active) setCredentialBusy(false);
      });
    return () => {
      active = false;
    };
  }, [client, step]);

  const updateCredentialStatus = (status: ProviderCredentialStatus) => {
    setProviderCredentials((current) => [
      ...current.filter((item) => item.provider !== status.provider),
      status,
    ]);
  };

  const chooseClient = (nextClient: ClientId) => {
    setCredentialNotice(null);
    setError(null);
    setClient(nextClient);
  };

  const chooseApiProvider = (provider: ApiProviderId) => {
    setCredentialNotice(null);
    setError(null);
    setApiProviderId(provider);
  };

  const chooseApiCredentialMode = (mode: ApiCredentialMode) => {
    setCredentialNotice(null);
    setError(null);
    setApiCredentialMode(mode);
  };

  const importCredential = async (apiKey: string) => {
    if (!managedCredentialAvailable) {
      setError('Stop the separately managed local service before importing a Keychain-managed key.');
      return;
    }
    if (!apiKey.trim()) {
      setError(`Enter a ${apiProvider.name} API key first.`);
      return;
    }
    setCredentialBusy(true);
    setError(null);
    setCredentialNotice(null);
    try {
      updateCredentialStatus(await importProviderApiKey(apiProvider.id, apiKey));
      setApiCredentialMode('keychain');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setCredentialBusy(false);
    }
  };

  const removeCredential = async () => {
    setCredentialBusy(true);
    setError(null);
    setCredentialNotice(null);
    try {
      updateCredentialStatus(await removeProviderApiKey(apiProvider.id));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setCredentialBusy(false);
    }
  };

  const copyLocalAccessToken = async () => {
    setCredentialBusy(true);
    setError(null);
    setCredentialNotice(null);
    try {
      await copyProviderLocalAccessToken(apiProvider.id);
      setCredentialNotice(`Local access token copied. Use it as ${apiProvider.environmentVariable} with this local route.`);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setCredentialBusy(false);
    }
  };

  const goBack = () => {
    setError(null);
    if (step === 'protection') {
      setProtectionMode('keychain');
      setPassphrase('');
      setPassphraseConfirmation('');
    }
    setStep(onboardingSteps[Math.max(0, stepIndex - 1)]);
  };

  const configureProtection = async () => {
    if (protectionMode === 'passphrase' && passphrase !== passphraseConfirmation) {
      setError('The passphrases do not match.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (!state.vault_configured) {
        await configureVault(protectionMode, protectionMode === 'passphrase' ? passphrase : undefined);
        setPassphrase('');
        setPassphraseConfirmation('');
        await refresh();
      }
      setStep('notary');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const startService = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!state.running) await startDaemon();
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 12; attempt += 1) {
        try {
          await setCaptureEnabled(true);
          lastError = null;
          break;
        } catch (caught) {
          lastError = caught;
          await new Promise((resolve) => window.setTimeout(resolve, 250));
        }
      }
      if (lastError) throw lastError;
      await new Promise((resolve) => window.setTimeout(resolve, 350));
      const baseline = await getRecentTraceProbes();
      await refresh();
      setTestBaseline(new Set(baseline.map((trace) => trace.trace_id)));
      setTestStatus('idle');
      setStep('test');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const checkForTestTrace = async () => {
    setTestStatus('checking');
    setError(null);
    try {
      const expectedProvider = expectedTestProvider(client, apiProvider);
      const traceId = testBaseline === null ? null : await confirmDisposableTrace(
        [...testBaseline],
        expectedProvider,
        testMarker,
      );
      await refresh();
      setTestStatus(traceId ? 'captured' : 'not-found');
    } catch (caught) {
      setError(errorMessage(caught));
      setTestStatus('not-found');
    }
  };

  const finish = async (destination: View) => {
    setBusy(true);
    setError(null);
    try {
      await completeOnboarding();
      await refresh();
      onFinish(destination);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return <div className="onboarding-window exalto-onboarding">
    <header className="onboarding-toolbar" data-tauri-drag-region="deep">
      <div className="traffic-light-space" data-tauri-drag-region />
      <div className="onboarding-brand" data-tauri-drag-region="deep">
        <img src={notaryMark} alt="" />
        <strong data-tauri-drag-region>Exalto Capture</strong>
      </div>
      <span className="onboarding-window-context">Setup {String(stepIndex + 1).padStart(2, '0')} / 06</span>
      {onCancel && <button className="onboarding-close" type="button" onClick={onCancel} disabled={busy || credentialBusy}>Done</button>}
    </header>
    <div className="onboarding-progress" aria-label={`Setup step ${stepIndex + 1} of ${onboardingSteps.length}`}>
      {onboardingSteps.map((item, index) => <span key={item} className={index <= stepIndex ? 'is-complete' : ''} />)}
    </div>
    <main className="onboarding-body">
      <section className="onboarding-content">
        {step !== 'welcome' && <button className="back-button" type="button" onClick={goBack} disabled={busy || credentialBusy}>
          <ChevronLeft size={14} /> Back
        </button>}
        {step === 'welcome' && <WelcomeStep state={state} onContinue={() => setStep('protection')} />}
        {step === 'protection' && <ProtectionStep
          configured={state.vault_configured}
          mode={protectionMode}
          setMode={setProtectionMode}
          passphrase={passphrase}
          setPassphrase={setPassphrase}
          passphraseConfirmation={passphraseConfirmation}
          setPassphraseConfirmation={setPassphraseConfirmation}
          busy={busy}
          onContinue={() => void configureProtection()}
        />}
        {step === 'notary' && <NotaryStep onContinue={() => setStep('client')} />}
        {step === 'client' && <ClientStep
          client={client}
          setClient={chooseClient}
          apiProvider={apiProvider}
          setApiProvider={chooseApiProvider}
          apiCredentialMode={apiCredentialMode}
          setApiCredentialMode={chooseApiCredentialMode}
          providerCredential={providerCredential}
          managedCredentialAvailable={managedCredentialAvailable}
          credentialBusy={credentialBusy}
          credentialNotice={credentialNotice}
          onImportCredential={importCredential}
          onRemoveCredential={removeCredential}
          onCopyLocalAccessToken={copyLocalAccessToken}
          busy={busy}
          running={state.running}
          onContinue={() => void startService()}
        />}
        {step === 'test' && <TestTraceStep
          client={client}
          apiProvider={apiProvider}
          managedApiKey={managedApiKey}
          testPrompt={testPrompt}
          state={state}
          status={testStatus}
          onCheck={() => void checkForTestTrace()}
          onContinue={() => setStep('account')}
          onSkip={() => setStep('account')}
        />}
        {step === 'account' && <AccountReadyStep
          state={state}
          client={client}
          apiProvider={apiProvider}
          busy={busy}
          onFinish={finish}
        />}
        {error && <div className="onboarding-error" role="alert">{error}</div>}
      </section>
      <OnboardingAside
        step={step}
        client={client}
        apiProvider={apiProvider}
        apiCredentialMode={apiCredentialMode}
        managedApiKey={managedApiKey}
        testStatus={testStatus}
      />
    </main>
  </div>;
}

function WelcomeStep({ state, onContinue }: { state: DesktopState; onContinue: () => void }) {
  const fresh = !state.agent_configured && !state.vault_configured;
  return <div className="wizard-step welcome-step">
    <span className="wizard-kicker">Local trace capture</span>
    <h1>Set up Exalto Capture</h1>
    <p>{fresh
      ? 'Capture a model exchange on this Mac, review what a sealed trace can reveal, then send it to Exalto Seal or another compatible notary for sealing.'
      : 'This Mac already has capture settings. Setup will preserve them while it checks the path from your AI tool to a portable trace.'}</p>
    <div className="capture-workflow" aria-label="Capture, review, seal, then verify or share">
      {['Capture', 'Review', 'Seal', 'Verify or share'].map((label, index) => <div key={label}>
        <span>{String(index + 1).padStart(2, '0')}</span>
        <strong>{label}</strong>
      </div>)}
    </div>
    <figure className="trace-receipt" aria-label="A sample local trace receipt">
      <figcaption><span><CircleDot size={11} /> REC</span><code>TRACE / LOCAL</code></figcaption>
      <dl>
        <div><dt>AI tool</dt><dd>Codex CLI</dd></div>
        <div><dt>Provider</dt><dd>Authenticated response</dd></div>
        <div><dt>Private content</dt><dd>Hidden from the notary</dd></div>
        <div><dt>Portable result</dt><dd>.llmtrace</dd></div>
      </dl>
      <p>A trace proves the interaction it contains. It does not prove that omitted interactions never happened.</p>
    </figure>
    <div className="wizard-actions"><button className="mac-button is-primary is-large" onClick={onContinue}>Begin setup <ChevronRight size={15} /></button></div>
  </div>;
}

function ProtectionStep({ configured, mode, setMode, passphrase, setPassphrase, passphraseConfirmation, setPassphraseConfirmation, busy, onContinue }: {
  configured: boolean;
  mode: VaultSetupMode;
  setMode: (value: VaultSetupMode) => void;
  passphrase: string;
  setPassphrase: (value: string) => void;
  passphraseConfirmation: string;
  setPassphraseConfirmation: (value: string) => void;
  busy: boolean;
  onContinue: () => void;
}) {
  const [advancedOpen, setAdvancedOpen] = useState(mode === 'passphrase');
  const passphrasesMatch = passphrase === passphraseConfirmation;
  const mismatchId = 'vault-passphrase-mismatch';
  const chooseKeychain = () => {
    setMode('keychain');
    setPassphrase('');
    setPassphraseConfirmation('');
  };
  const toggleAdvanced = () => {
    if (advancedOpen) chooseKeychain();
    setAdvancedOpen(!advancedOpen);
  };
  return <div className="wizard-step">
    <span className="wizard-kicker">Local protection</span>
    <h1>Protect private traces on this Mac</h1>
    <p>A full private capture can reconstruct the original provider request, including credentials. Exalto Capture vault-encrypts that artifact before writing it to disk.</p>
    <div className="wizard-warning preview-storage-warning" role="note"><LockKeyhole size={16} /><span>When retained previews are enabled, short prompt and response excerpts are also kept in local metadata so Traces can be browsed. Those excerpts stay on this Mac but are not protected by the trace vault.</span></div>
    {configured ? <div className="configured-protection"><BadgeCheck size={22} /><div><strong>Local protection is already configured</strong><span>Your existing vault will remain unchanged.</span></div></div> : <div className="protection-options" role="radiogroup" aria-label="Private trace protection">
      <button type="button" role="radio" aria-checked={mode === 'keychain'} className={mode === 'keychain' ? 'is-selected' : ''} onClick={chooseKeychain}>
        <span className="radio-mark">{mode === 'keychain' && <span />}</span><KeyRound size={20} />
        <div><strong>Use macOS Keychain</strong><p>Recommended. macOS protects the vault key, with no separate password to remember.</p></div>
      </button>
      {advancedOpen && <button type="button" role="radio" aria-checked={mode === 'passphrase'} className={mode === 'passphrase' ? 'is-selected' : ''} onClick={() => setMode('passphrase')}>
        <span className="radio-mark">{mode === 'passphrase' && <span />}</span><SlidersHorizontal size={20} />
        <div><strong>Use a passphrase</strong><p>Enter it whenever the app opens. Exalto Capture does not save it.</p></div>
      </button>}
    </div>}
    {!configured && <button type="button" className="advanced-options-toggle" aria-expanded={advancedOpen} onClick={toggleAdvanced}><SlidersHorizontal size={13} /> Advanced protection <ChevronDown size={13} /></button>}
    {!configured && advancedOpen && mode === 'passphrase' && <div className="passphrase-fields">
      <label><span>Passphrase</span><input type="password" autoComplete="new-password" value={passphrase} aria-invalid={!passphrasesMatch} aria-describedby={!passphrasesMatch ? mismatchId : undefined} onChange={(event) => setPassphrase(event.target.value)} /></label>
      <label><span>Confirm passphrase</span><input type="password" autoComplete="new-password" value={passphraseConfirmation} aria-invalid={!passphrasesMatch} aria-describedby={!passphrasesMatch ? mismatchId : undefined} onChange={(event) => setPassphraseConfirmation(event.target.value)} /></label>
      {!passphrasesMatch && <small id={mismatchId} className="passphrase-mismatch" role="alert">The passphrases do not match.</small>}
    </div>}
    {!configured && advancedOpen && mode === 'passphrase' && passphrasesMatch && passphrase.length === 0 && <div className="wizard-warning"><ShieldCheck size={16} /><span>An empty passphrase provides no device protection. Anyone with access to this account's app data can open private traces.</span></div>}
    <div className="wizard-actions"><button className="mac-button is-primary is-large" onClick={onContinue} disabled={busy || (mode === 'passphrase' && (!advancedOpen || !passphrasesMatch))}>{busy ? 'Saving…' : 'Protect traces'} <ChevronRight size={15} /></button></div>
  </div>;
}

function NotaryStep({ onContinue }: { onContinue: () => void }) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  return <div className="wizard-step notary-step">
    <span className="wizard-kicker">Confirm the notary</span>
    <h1>Start with Exalto Seal</h1>
    <p>The notary witnesses the provider connection while seeing encrypted protocol data, not your prompt, response, or provider credentials.</p>
    <div className="notary-choice is-selected">
      <span className="notary-choice-mark"><Check size={15} /></span>
      <div><strong>Exalto Seal</strong><p>The recommended hosted notary for this build. Local capture works before you connect an Exalto account.</p></div>
      <span className="choice-status">Recommended</span>
    </div>
    <button type="button" className="advanced-options-toggle" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen(!advancedOpen)}><Network size={13} /> About compatible notaries <ChevronDown size={13} /></button>
    {advancedOpen && <div className="advanced-notaries">
      <div><Server size={17} /><span><strong>Compatible notary</strong><small>Manual runtime configuration required</small></span><em>Not configured</em></div>
      <div><SquareTerminal size={17} /><span><strong>Self-hosted notary</strong><small>Operator endpoint and verification key required</small></span><em>Not configured</em></div>
      <p>This build preserves the pinned notary selected by its runtime configuration. Switching or adding a compatible notary requires an administrator-managed configuration.</p>
    </div>}
    <div className="notary-boundary">
      <div><span>REMOTE NOTARY SEES</span><strong>Provider hostname, encrypted traffic, sizes, timing</strong></div>
      <div><span>APPLICATION PLAINTEXT</span><strong>Visible to this Mac and your chosen model provider</strong></div>
    </div>
    <div className="wizard-actions"><button className="mac-button is-primary is-large" type="button" onClick={onContinue}>Continue with Exalto Seal <ChevronRight size={15} /></button></div>
  </div>;
}

function ClientStep({
  client,
  setClient,
  apiProvider,
  setApiProvider,
  apiCredentialMode,
  setApiCredentialMode,
  providerCredential,
  managedCredentialAvailable,
  credentialBusy,
  credentialNotice,
  onImportCredential,
  onRemoveCredential,
  onCopyLocalAccessToken,
  busy,
  running,
  onContinue,
}: {
  client: ClientId;
  setClient: (client: ClientId) => void;
  apiProvider: ApiProvider;
  setApiProvider: (provider: ApiProviderId) => void;
  apiCredentialMode: ApiCredentialMode;
  setApiCredentialMode: (mode: ApiCredentialMode) => void;
  providerCredential: ProviderCredentialStatus | undefined;
  managedCredentialAvailable: boolean;
  credentialBusy: boolean;
  credentialNotice: string | null;
  onImportCredential: (apiKey: string) => Promise<void>;
  onRemoveCredential: () => Promise<void>;
  onCopyLocalAccessToken: () => Promise<void>;
  busy: boolean;
  running: boolean;
  onContinue: () => void;
}) {
  return <div className="wizard-step client-step">
    <span className="wizard-kicker">Connect an AI tool</span>
    <h1>Which local tool will you use first?</h1>
    <p>Codex CLI and Claude Code keep their saved sign-ins. API clients can use a Keychain-managed key or keep their current environment.</p>
    <div className="client-picker" role="radiogroup" aria-label="AI tool to connect first">
      {clientChoices.map((item) => <button key={item.id} type="button" role="radio" aria-checked={client === item.id} className={client === item.id ? 'is-selected' : ''} onClick={() => setClient(item.id)} disabled={credentialBusy}>
        <span className="radio-mark">{client === item.id && <span />}</span>
        <div><strong>{item.name}</strong><p>{item.detail}</p></div>
        <small>{item.status}</small>
      </button>)}
    </div>
    {client === 'codex' && <div className="connection-instructions">
      <div className="instruction-heading"><span>CODEX CLI / SAVED CHATGPT SIGN-IN</span><strong>1. Confirm login, then add the local provider</strong></div>
      <pre><code>codex login status</code></pre>
      <p>The result must say <code>Logged in using ChatGPT</code>. Then add this to <code>~/.codex/config.toml</code> and keep your current model setting.</p>
      <pre><code>{CODEX_CONFIG}</code></pre>
      <p>Do not add <code>env_key</code>. Codex keeps and attaches its saved ChatGPT authorization.</p>
    </div>}
    {client === 'claude' && <div className="connection-instructions">
      <div className="instruction-heading"><span>CLAUDE CODE / SAVED CLAUDE.AI SIGN-IN</span><strong>1. Confirm login, then launch through the local route</strong></div>
      <pre><code>claude auth status</code></pre>
      <p>It must report <code>loggedIn: true</code>. A Claude Desktop login is separate and does not establish this CLI session.</p>
      <pre><code>{CLAUDE_COMMAND}</code></pre>
      <p>Remove any <code>apiKeyHelper</code> while using subscription authentication. Native Claude Desktop cannot use this route.</p>
    </div>}
    {client === 'api' && <ApiConnection
      apiProvider={apiProvider}
      setApiProvider={setApiProvider}
      credentialMode={apiCredentialMode}
      setCredentialMode={setApiCredentialMode}
      credential={providerCredential}
      managedCredentialAvailable={managedCredentialAvailable}
      busy={credentialBusy}
      notice={credentialNotice}
      onImport={onImportCredential}
      onRemove={onRemoveCredential}
      onCopyLocalAccessToken={onCopyLocalAccessToken}
    />}
    <div className="wizard-warning credential-capture-warning" role="note">
      <LockKeyhole size={16} />
      <span>An encrypted private <code>.llmcapture</code> can reconstruct the authenticated provider request, including credential-bearing header bytes. Treat private captures as secrets and never share them.</span>
    </div>
    <div className="wizard-actions"><button
      className="mac-button is-primary is-large"
      type="button"
      onClick={onContinue}
      disabled={busy || credentialBusy || (client === 'api' && apiCredentialMode === 'keychain' && !providerCredential?.configured)}
    >{busy ? 'Starting capture service…' : running ? 'Continue to test' : 'Start capture service'} <ChevronRight size={15} /></button></div>
  </div>;
}

function ApiConnection({
  apiProvider,
  setApiProvider,
  credentialMode,
  setCredentialMode,
  credential,
  managedCredentialAvailable,
  busy,
  notice,
  onImport,
  onRemove,
  onCopyLocalAccessToken,
}: {
  apiProvider: ApiProvider;
  setApiProvider: (provider: ApiProviderId) => void;
  credentialMode: ApiCredentialMode;
  setCredentialMode: (mode: ApiCredentialMode) => void;
  credential: ProviderCredentialStatus | undefined;
  managedCredentialAvailable: boolean;
  busy: boolean;
  notice: string | null;
  onImport: (apiKey: string) => Promise<void>;
  onRemove: () => Promise<void>;
  onCopyLocalAccessToken: () => Promise<void>;
}) {
  const apiKeyInput = useRef<HTMLInputElement>(null);
  const submitApiKey = () => {
    const apiKey = apiKeyInput.current?.value ?? '';
    if (apiKeyInput.current) apiKeyInput.current.value = '';
    void onImport(apiKey);
  };
  const validationLabel = credential?.validation === 'valid'
    ? 'Validated directly with the provider'
    : credential?.validation === 'invalid'
      ? credential.configured
        ? 'Provider rejected the replacement. The existing key remains active.'
        : 'Provider rejected this key'
      : credential?.validation === 'unavailable'
        ? credential.configured
          ? 'Validation was unavailable. The existing key remains active.'
          : 'Provider validation was unavailable'
        : 'Stored locally, not checked this session';
  const credentialStatusTitle = credential?.validation === 'invalid'
    ? credential.configured ? 'Replacement was not accepted' : 'Key was not accepted'
    : credential?.validation === 'unavailable'
      ? credential.configured ? 'Replacement was not saved' : 'Key was not saved'
      : credential?.configured
        ? `${apiProvider.name} key is ready`
        : 'Key was not saved';
  const showCredentialStatus = Boolean(credential?.configured)
    || credential?.validation === 'invalid'
    || credential?.validation === 'unavailable';

  return <div className="api-connection">
    <div className="api-provider-picker" role="radiogroup" aria-label="API provider">
      {apiProviders.map((provider) => <button key={provider.id} type="button" role="radio" aria-checked={apiProvider.id === provider.id} className={apiProvider.id === provider.id ? 'is-selected' : ''} onClick={() => setApiProvider(provider.id)} disabled={busy}>{provider.name}</button>)}
      <button type="button" className="is-unsupported" disabled><span>xAI / Grok</span><small>Not yet supported</small></button>
    </div>
    <div className="unsupported-provider-guide">
      <span><strong>Planning to use Grok?</strong><small>Create an xAI API key now. The xAI and Grok capture route is not available in this build.</small></span>
      <a href="https://docs.x.ai/developers/quickstart" target="_blank" rel="noreferrer" onClick={(event) => {
        event.preventDefault();
        void openProductLink('xai_key');
      }}>Open the xAI key guide <ExternalLink size={12} /></a>
    </div>
    <p className="credential-path-intro">Choose how this API client will authenticate. An imported Keychain route remains available until you remove it.</p>
    <div className="api-credential-mode" role="radiogroup" aria-label="Authentication path for this API client">
      <button type="button" role="radio" aria-checked={credentialMode === 'keychain'} className={credentialMode === 'keychain' ? 'is-selected' : ''} onClick={() => setCredentialMode('keychain')} disabled={busy || !managedCredentialAvailable}>
        <span className="radio-mark">{credentialMode === 'keychain' && <span />}</span>
        <span><strong>Use scoped local token</strong><small>Provider key stored in Keychain</small></span>
      </button>
      <button type="button" role="radio" aria-checked={credentialMode === 'external'} className={credentialMode === 'external' ? 'is-selected' : ''} onClick={() => setCredentialMode('external')} disabled={busy}>
        <span className="radio-mark">{credentialMode === 'external' && <span />}</span>
        <span><strong>Send provider key</strong><small>Your client or secret manager supplies it</small></span>
      </button>
    </div>
    {!managedCredentialAvailable && <div className="wizard-warning credential-service-warning"><ShieldCheck size={16} /><span>A separately managed local service cannot receive Keychain credentials. Use an environment key, or stop that service and restart setup from Exalto Capture.</span></div>}
    {showCredentialStatus && credential && <div className={`credential-status is-${credential.validation}`}>
      <span><KeyRound size={15} /></span>
      <div><strong>{credentialStatusTitle}</strong><small>{validationLabel}</small></div>
      {credential.configured && <button className="mac-button is-small" type="button" onClick={() => void onRemove()} disabled={busy}>Remove</button>}
    </div>}
    {credentialMode === 'keychain' ? <div className="connection-instructions api-key-instructions managed-key-instructions">
      <div className="instruction-heading"><span>{apiProvider.name.toUpperCase()} / MACOS KEYCHAIN</span><strong>{credential?.configured ? `Key ending in ${credential.masked_suffix ?? '••••'}` : 'No key imported'}</strong></div>
      <dl>
        <div><dt>Local token variable</dt><dd><code>{apiProvider.environmentVariable}</code></dd></div>
        <div><dt>Local base URL</dt><dd><code>{apiProvider.baseUrl}</code></dd></div>
      </dl>
      {credential?.configured && <div className="local-access-token">
        <div><strong>Local access token</strong><small>Use this scoped token as <code>{apiProvider.environmentVariable}</code>. The supervised local service reads the real provider key from Keychain.</small></div>
        <button className="mac-button is-small" type="button" onClick={() => void onCopyLocalAccessToken()} disabled={busy}>Copy local token</button>
      </div>}
      {notice && <div className="credential-notice" role="status">{notice}</div>}
      <form key={apiProvider.id} className="credential-import" onSubmit={(event) => {
        event.preventDefault();
        submitApiKey();
      }}>
        <label htmlFor={`provider-key-${apiProvider.id}`}>{credential?.configured ? `Replace ${apiProvider.name} key` : `${apiProvider.name} API key`}</label>
        <div>
          <input
            id={`provider-key-${apiProvider.id}`}
            ref={apiKeyInput}
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste key"
            disabled={busy}
          />
          <button className="mac-button is-primary" type="submit" disabled={busy}>{busy ? 'Checking…' : 'Validate and save'}</button>
        </div>
      </form>
      <a href={apiProvider.keyUrl} target="_blank" rel="noreferrer" onClick={(event) => {
        event.preventDefault();
        void openProductLink(apiProvider.keyDestination);
      }}>{apiProvider.keyLabel} <ExternalLink size={12} /></a>
      <p>The key is validated directly with {apiProvider.name}, then stored in macOS Keychain. The supervised local service loads it into memory and supplies it only when the matching local route receives that provider's unguessable local access token. Neither credential is sent to the remote notary.</p>
    </div> : <div className="connection-instructions api-key-instructions">
      <div className="instruction-heading"><span>{apiProvider.name.toUpperCase()} / CLIENT-MANAGED KEY</span><strong>Keep the key in your current environment</strong></div>
      <dl>
        <div><dt>Environment variable</dt><dd><code>{apiProvider.environmentVariable}</code></dd></div>
        <div><dt>Local base URL</dt><dd><code>{apiProvider.baseUrl}</code></dd></div>
      </dl>
      <a href={apiProvider.keyUrl} target="_blank" rel="noreferrer" onClick={(event) => {
        event.preventDefault();
        void openProductLink(apiProvider.keyDestination);
      }}>{apiProvider.keyLabel} <ExternalLink size={12} /></a>
      <p>Your SDK, CLI, shell, or secret manager remains the credential owner. Exalto Capture observes the authenticated local request but does not persist this environment key separately.</p>
      {credential?.configured && <p className="coexisting-credential-note">The Keychain-managed route is still available with its scoped local token. Remove the saved key above to disable that path.</p>}
    </div>}
  </div>;
}

function TestTraceStep({ client, apiProvider, managedApiKey, testPrompt, state, status, onCheck, onContinue, onSkip }: {
  client: ClientId;
  apiProvider: ApiProvider;
  managedApiKey: boolean;
  testPrompt: string;
  state: DesktopState;
  status: TestStatus;
  onCheck: () => void;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const credentialCopy = client === 'api' && managedApiKey
    ? 'The provider key is stored in macOS Keychain and loaded only by the supervised local service. Your client sends the scoped local access token.'
    : `The credential remains in ${client === 'api' ? `${apiProvider.name} tooling` : client === 'codex' ? 'Codex CLI' : 'Claude Code'}.`;
  return <div className="wizard-step test-step">
    <span className="wizard-kicker">Test local capture</span>
    <h1>Capture one disposable trace</h1>
    <p>Send a tiny request through the route you just configured. This confirms that the local path works before you rely on it for real evidence.</p>
    <div className="test-prompt-receipt">
      <span><CircleDot size={11} /> REC / SMALL TEST</span>
      <strong>{testPrompt}</strong>
      <small>Use a low-cost model available to your account. {credentialCopy} You can review and seal this disposable trace in Traces after setup.</small>
    </div>
    <div className="connection-instructions test-command">
      <div className="instruction-heading"><span>RUN IN TERMINAL</span><strong>{client === 'api' ? `Replace YOUR_MODEL with an available ${apiProvider.name} model` : 'Run one ephemeral request'}</strong></div>
      <pre><code>{testCommand(client, apiProvider, testPrompt)}</code></pre>
    </div>
    <div className={`test-result is-${status}`} role="status" aria-live="polite">
      <span>{status === 'captured' ? <Check size={16} /> : <StatusDot running={state.running} warning={!state.running} />}</span>
      <div>
        <strong>{status === 'captured' ? 'Test trace captured' : status === 'checking' ? 'Checking local traces' : status === 'not-found' ? 'No new trace yet' : state.running ? 'Capture service is ready' : 'Capture service is still starting'}</strong>
        <small>{status === 'captured' ? 'The matching response appeared in the local store. Finish setup, then open Traces to review and seal it.' : status === 'not-found' ? 'Run the command, wait for its response, then check again. Automatic confirmation requires response previews.' : 'Run the command above, then check for its matching response.'}</small>
      </div>
    </div>
    <div className="wizard-actions split-actions">
      {status === 'captured' ? <button className="mac-button is-primary is-large" type="button" onClick={onContinue}>Continue <ChevronRight size={15} /></button> : <button className="mac-button is-primary is-large" type="button" onClick={onCheck} disabled={status === 'checking'}>{status === 'checking' ? 'Checking…' : 'Check for new trace'}</button>}
      <button className="mac-button is-large" type="button" onClick={onSkip}>Skip test</button>
    </div>
  </div>;
}

function AccountReadyStep({ state, client, apiProvider, busy, onFinish }: {
  state: DesktopState;
  client: ClientId;
  apiProvider: ApiProvider;
  busy: boolean;
  onFinish: (destination: View) => Promise<void>;
}) {
  const clientLabel = client === 'codex' ? 'Codex CLI' : client === 'claude' ? 'Claude Code' : `${apiProvider.name} API or SDK`;
  const notaryLabel = state.notary === 'configured' ? 'Configured notary' : 'Exalto Seal';
  return <div className="wizard-step account-step ready-step">
    <span className="ready-check"><Check size={23} /></span>
    <span className="wizard-kicker">Ready</span>
    <h1>Exalto Capture is ready</h1>
    <p>Local capture does not require an Exalto account. Connect one now for hosted credits, usage, and account-owned sharing, or continue without it.</p>
    <div className="ready-summary">
      <div><span><StatusDot running={state.running} /></span><strong>Capture service</strong><small>{state.running ? 'Running on this Mac' : 'Starting'}</small></div>
      <div><span><SquareTerminal size={15} /></span><strong>First AI tool</strong><small>{clientLabel}</small></div>
      <div><span><FileCheck2 size={15} /></span><strong>Notary</strong><small>{notaryLabel}</small></div>
      <div><span><ShieldCheck size={15} /></span><strong>Local vault</strong><small>{vaultProtection(state.vault_mode).label}</small></div>
    </div>
    <DesktopAccountCard compact />
    <div className="wizard-actions split-actions final-actions">
      <button className="mac-button is-primary is-large" type="button" onClick={() => void onFinish('home')} disabled={busy}>{busy ? 'Finishing setup…' : 'Open Capture'} <ChevronRight size={15} /></button>
      <button className="mac-button is-large" type="button" onClick={() => void onFinish('traces')} disabled={busy}>Open Traces to seal</button>
    </div>
  </div>;
}

function OnboardingAside({ step, client, apiProvider, apiCredentialMode, managedApiKey, testStatus }: {
  step: OnboardingStep;
  client: ClientId;
  apiProvider: ApiProvider;
  apiCredentialMode: ApiCredentialMode;
  managedApiKey: boolean;
  testStatus: TestStatus;
}) {
  const clientLabel = client === 'codex' ? 'Codex CLI' : client === 'claude' ? 'Claude Code' : `${apiProvider.name} SDK`;
  const keychainRouteSelected = client === 'api' && apiCredentialMode === 'keychain';
  const content = {
    welcome: {
      label: 'TRACE WORKFLOW',
      title: 'Local first, portable when you choose',
      copy: 'Capture keeps a private record on this Mac. Sealing creates a portable .llmtrace. Sharing is always a later explicit action.',
    },
    protection: {
      label: 'LOCAL BOUNDARY',
      title: 'Full captures are encrypted, previews are separate',
      copy: 'The reconstructable capture is vault-encrypted. If retained previews are enabled, bounded excerpts stay in local metadata outside that vault.',
    },
    notary: {
      label: 'NOTARY BOUNDARY',
      title: 'The witness sees ciphertext, not the conversation',
      copy: 'Exalto Seal participates in the provider connection. It receives encrypted protocol data and the upstream hostname, never application plaintext.',
    },
    client: {
      label: 'CLIENT FIRST',
      title: managedApiKey
        ? 'This Mac protects the provider key'
        : keychainRouteSelected
          ? `Import the ${apiProvider.name} key to this Mac`
          : `${clientLabel} remains the credential owner`,
      copy: managedApiKey
        ? 'The provider key is stored in macOS Keychain and loaded into the supervised local service. It is inserted only after this provider route receives its unguessable local access token.'
        : keychainRouteSelected
          ? 'Validate the provider key, save it in macOS Keychain, then give this client a scoped local token instead of the provider secret.'
          : 'Only its provider base URL changes. The login, API key, model selection, and request continue to be managed by the tool.',
    },
    test: {
      label: 'DISPOSABLE TRACE',
      title: testStatus === 'captured' ? 'The local route is working' : 'Prove the path with a tiny request',
      copy: 'The test is deliberately small. Keep it private, inspect it later, or delete it when you no longer need it.',
    },
    account: {
      label: 'OPTIONAL ACCOUNT',
      title: 'Capture now, connect hosted services when useful',
      copy: 'An account enables hosted credits, usage, and account-owned sharing. It does not upload or publish local traces automatically.',
    },
  }[step];
  return <aside className="onboarding-aside">
    <span className="aside-label">{content.label}</span>
    <h2>{content.title}</h2>
    <p>{content.copy}</p>
    <div className="aside-flow" aria-label="Local capture path">
      <div className={step === 'client' ? 'is-active' : ''}><span>01</span><strong>{clientLabel}</strong><small>{managedApiKey ? 'Scoped token in client' : keychainRouteSelected ? 'Keychain route selected' : 'Login and key managed here'}</small></div>
      <div className={step === 'protection' || step === 'test' ? 'is-active is-local' : 'is-local'}><span>02</span><strong>Exalto Capture</strong><small>Loopback and private vault</small></div>
      <div className={step === 'notary' ? 'is-active' : ''}><span>03</span><strong>Exalto Seal</strong><small>Encrypted witness</small></div>
      <div><span>04</span><strong>Model provider</strong><small>Authenticated response</small></div>
    </div>
    <div className="aside-privacy"><LockKeyhole size={17} /><span>Prompts, responses, and provider credentials are not sent to the remote notary.</span></div>
  </aside>;
}
