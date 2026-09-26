// Documentation content. Data only, so any renderer can read it.

export type DocPageKey =
  | 'overview'
  | 'how-it-works'
  | 'getting-started'
  | 'hosted-credits'
  | 'trace-packages'
  | 'share';

export type DocStep = { title: string; body: string };
export type DocCard = { meta: string; title: string; body: string };
export type DocColumn = { title: string; items: string[] };
export type DocDefinition = { term: string; description: string };
export type DocBlock = {
  heading: string;
  body?: string;
  code?: string;
  note?: string;
  items?: string[];
  steps?: DocStep[];
  cards?: DocCard[];
  columns?: DocColumn[];
  definitions?: DocDefinition[];
  macosDownload?: boolean;
};
export type DocPage = { title: string; lead: string; blocks: DocBlock[] };
export type DocOutlineItem = { block: DocBlock; children: DocBlock[] };
export type DocNavigationGroup = { label: string; pages: Array<readonly [DocPageKey, string]> };

const installCommand = 'curl -fsSL https://capture.exalto.ai/install.sh | sh';
export const legalNotice =
  'Exalto Seal is not a notary public. Sealing is not a notarial act. A receipt is cryptographic evidence, not a legal instrument. The ENP specification uses "notary" as a technical role term, in the way public-key infrastructure uses "certificate authority."';

export const docPages: Record<DocPageKey, DocPage> = {
  overview: {
    title: 'How Exalto Capture and Exalto Seal fit.',
    lead: 'Run your existing model client through a local proxy, keep encrypted evidence on your machine, and turn only the interactions you choose into independently verifiable OpenTelemetry trace packages.',
    blocks: [
      {
        heading: 'The workflow',
        steps: [
          {
            title: 'Capture',
            body: 'Point an SDK or agent at the local proxy. Requests and streamed responses continue normally while each completed provider call becomes an encrypted local capture.',
          },
          {
            title: 'Choose',
            body: 'Captures wait on your disk. Nothing is shared automatically, and interactive model use does not wait for the expensive proof step.',
          },
          {
            title: 'Seal',
            body: 'Turn a selected capture into authenticated TLS evidence and a deterministic OTel GenAI trace. This can happen long after the original model call.',
          },
          {
            title: 'Verify or share',
            body: 'Check the package locally, keep it private, or deliberately share its disclosed conversation and portable proof through a stable link.',
          },
        ],
      },
      {
        heading: 'One Trace, two evidence states',
        cards: [
          {
            meta: 'Captured',
            title: 'Private local evidence',
            body: 'The Trace retains a sensitive encrypted capture that can be sealed later. It is not yet evidence another person can verify.',
          },
          {
            meta: 'Sealed',
            title: 'Portable Trace package',
            body: 'TLSNotary evidence, disclosed authenticated HTTP, canonical OTLP, and a manifest binding the files together.',
          },
        ],
      },
      {
        heading: 'Sharing is a separate action',
        body: 'A Sealed Trace can remain local or be shared deliberately. Sharing hosts the exact admitted .llmtrace package and its disclosed conversation; it does not create another evidence state.',
      },
      {
        heading: 'What is automatic',
        items: [
          'The first service start creates or opens the local encrypted-capture vault. On a desktop OS, its random key is stored in the system credential service.',
          'The service discovers the production notary endpoint and public key from the Exalto Seal Registry, then pins that trust information locally.',
          'Sealing and verification use the pinned notary identity. Normal hosted use does not require copying a public key into an API request.',
          'Provider credentials remain in your existing SDK or agent environment; the local service does not require a project .env file.',
        ],
      },
      {
        heading: 'A first successful run',
        code: `${installCommand}\n\nnotaryd\n# Open http://127.0.0.1:8788 for the local dashboard.\n# Point an OpenAI client at http://127.0.0.1:8787/openai/v1.\n\nnotaryctl status\nnotaryctl traces list`,
      },
      {
        heading: 'The claim',
        note: 'A trusted notary attests that disclosed bytes came from an authenticated TLS interaction with the named provider, and the Exalto Notary Protocol deterministically binds the OpenTelemetry representation to those bytes.',
      },
    ],
  },
  'how-it-works': {
    title: 'Trust and guarantees',
    lead: 'The Exalto Notary Protocol makes a narrow provenance claim. Understanding who sees what—and what the proof does not establish—is part of using it correctly.',
    blocks: [
      {
        heading: 'Each participant',
        cards: [
          {
            meta: 'User / client',
            title: 'Holds the plaintext',
            body: 'The local proxy sees the request and response. A user cannot change authenticated bytes or invent a provider response and still produce valid sealed evidence.',
          },
          {
            meta: 'Notary',
            title: 'Witnesses ciphertext',
            body: 'The notary sees the provider hostname, encrypted traffic, sizes, timing, and protocol metadata. It does not receive the API key, prompt, or response plaintext.',
          },
          {
            meta: 'Provider',
            title: 'Serves a normal request',
            body: 'No provider integration is required. Origin follows from the authenticated provider TLS session, not from a special provider signature.',
          },
          {
            meta: 'Verifier',
            title: 'Checks independently',
            body: 'A verifier checks the notary signature, provider identity, disclosed transcript, artifact hashes, and deterministic mapping using the trusted notary public key.',
          },
        ],
      },
      {
        heading: 'Authenticated versus observed',
        items: [
          'A model-emitted tool call is authenticated provider output.',
          'A tool result in the next request proves that the client sent that value—not that the local tool really ran or returned a truthful result.',
          'A session ID is authenticated as client-supplied request metadata. It can correlate calls, but it does not prove one genuine agent process created them.',
          'Each provider call is proved independently. A larger agent run can group those calls without upgrading locally observed activity into provider-authenticated evidence.',
        ],
      },
      {
        heading: 'What this does not prove',
        items: [
          'That a response is correct, safe, complete, or useful.',
          'That a particular human authored the prompt.',
          'That every call from a larger session was disclosed.',
          'That a local tool executed, or that its reported output was accurate.',
          'That the trusted notary private key has never been compromised.',
        ],
      },
      {
        heading: 'How trust is established',
        body: 'The service retrieves the versioned Exalto Seal Registry over authenticated HTTPS and caches its key history. The JSON directory is not separately signed. Sealed packages identify the notary key that signed their evidence; verification accepts it only if that key was trusted at the package timestamp. A self-hosted deployment pairs `notary.endpoint` with `notary.public_key` in `config.toml`, but that is not part of the normal hosted workflow.',
      },
    ],
  },
  'getting-started': {
    title: 'Choose how to capture.',
    lead: 'Use the guided macOS app for everyday capture and review. Use the CLI and local service when you are integrating an SDK, coding agent, server, or automated workflow.',
    blocks: [],
  },
  'hosted-credits': {
    title: 'Plans and usage',
    lead: 'Each subscription has separate monthly capture and sealing allowances, plus storage for uploaded trace packages.',
    blocks: [
      {
        heading: 'Three plans',
        body: 'Free includes 50 MB of capture and 50 MB of sealing each month, with up to 1 GB of uploaded trace packages. The $9.99 monthly plan includes 1 GB for each monthly allowance and up to 10 GB of trace packages. The $49.99 monthly plan includes 10 GB for each monthly allowance and no fixed trace-storage ceiling, subject to fair-use and abuse controls.',
      },
      {
        heading: 'Capture and sealing are separate',
        body: 'A hosted capture reserves capture allowance for its authenticated HTTP byte limit. Turning a capture into a portable proof spends sealing allowance separately. Monthly allowances refresh on the account reset date; unused monthly allowance does not roll over.',
      },
      {
        heading: 'Buy more sealing',
        body: 'Every plan can buy additional sealing credits for $10 USD per GB through Stripe Checkout. Purchased credits do not expire. Exalto Seal consumes monthly sealing allowance before non-expiring purchased credits. Refunds and disputes remove the corresponding credits; reinstated payments restore them.',
      },
      {
        heading: 'Trace storage',
        body: 'The trace limit is the total declared size of trace-package uploads that are in progress, being checked, or admitted to your account. Rejected, failed, expired, and purged uploads do not count. A per-file safety limit still applies on every plan.',
      },
      {
        heading: 'Anonymous allowances are scoped by network address',
        body: 'Public hosted use derives a rotating, keyed subject from the connection address: one IPv4 address or one IPv6 /64 prefix. Only explicitly trusted reverse proxies may supply the client address. The raw address is not stored in admission records or sent to a notary worker.',
      },
      {
        heading: 'An abuse control, not an identity claim',
        note: 'Network-address scoping is only a coarse abuse control. People behind the same NAT, corporate gateway, or VPN can share an allowance, while one person may appear under different addresses. The derived subject does not identify a person and is not a privacy guarantee.',
      },
      {
        heading: 'Your usage',
        body: 'Your Exalto account shows the current plan, capture and sealing balances, trace storage, monthly reset, purchases, offers, and activity. A connected local service can retrieve the same account summary with `notaryctl account show --json`.',
      },
      {
        heading: 'Evidence is unchanged',
        body: 'Admission and credit bookkeeping do not change TLSNotary evidence, trace-package verification, local capture retention, or the trust claim. Self-hosted notaries do not need the hosted credit ledger unless their operator deliberately adopts it.',
      },
    ],
  },
  'trace-packages': {
    title: 'Seal and verify',
    lead: 'Turn one encrypted capture into a portable evidence package, inspect its canonical OpenTelemetry trace, and verify the entire package offline.',
    blocks: [],
  },
  share: {
    title: 'Share a Sealed Trace',
    lead: 'Sharing is a deliberate upload of one already-sealed package. The local service verifies it and shows the full disclosed conversation before it contacts Exalto Seal.',
    blocks: [
      {
        heading: 'Connect the local service',
        body: 'Open a Sealed Trace in the local workspace, choose Share, or begin the documented `POST /v1/account` device flow and poll its returned request identifier at the required interval.',
      },
      {
        heading: 'Choose visibility',
        body: 'Review the conversation and tool content from the exact `.llmtrace` package, then choose Unlisted or Listed, an optional password, and an optional expiration. Unlisted stays out of public Traces but is not private: anyone with an unprotected, unexpired URL can open it.',
      },
      {
        heading: 'Manage access after admission',
        body: 'From the originating local Trace or Account → Traces, you can copy or open the canonical link, change Listed or Unlisted visibility, replace or remove a password, change or clear an expiration of up to 365 days, and stop sharing. Protected Listed traces remain discoverable, but their conversation previews are withheld.',
      },
      {
        heading: 'Share one Sealed Trace',
        code: 'PUT /v1/traces/{trace_id}/share\n{"visibility":"unlisted"}',
      },
      {
        heading: 'Script-friendly output',
        body: 'Poll the same Trace share singleton on the loopback administration API so the browser or agent never receives the vault-held hosted credential.',
        code: '{"trace_id":"trc-…","progress":"shared","visibility":"unlisted","access_enabled":true,"password_protected":false,"expires_at_unix_ms":null,"failure_code":null,"share_url":"https://exalto.ai/s/trc-…","package_url":"https://api.exalto.ai/api/public/traces/trc-…/package.llmtrace","updated_at_unix_ms":1785294000000}',
      },
      {
        heading: 'The upload boundary',
        columns: [
          {
            title: 'Uploaded',
            items: [
              'evidence.tlsn and manifest.json',
              'request.disclosed.http with all header values hidden by default',
              'response.disclosed.http with authenticated provider output',
              'the deterministic trace.otlp.json',
            ],
          },
          {
            title: 'Never uploaded',
            items: [
              'encrypted .llmcapture state',
              'API-key or cookie values',
              'unselected captures from the same session',
              'extra files or symlink targets',
            ],
          },
        ],
      },
      {
        heading: 'Admission checks',
        body: 'The local service and hosted admission service validate the deterministic archive, verify its evidence, require hidden header values, and scan every archive entry and nested disclosed body for credential patterns and high-entropy secrets. After storage, admission downloads the public package and requires its size, SHA-256 digest, and exact bytes to match the package already verified before exposing the link.',
      },
      {
        heading: 'Current consent boundary',
        body: 'The admission service inspects disclosed request and response bodies, system context, and tool data to verify and reproduce the shared view. Every HTTP header value is hidden except the exact structural value Transfer-Encoding: chunked.',
      },
      {
        heading: 'Exact package retention',
        body: 'An admitted shared Trace keeps the exact verified `.llmtrace` bytes, size, and SHA-256 digest. The public Trace page makes that package available for independent verification; the encrypted `.llmcapture` never leaves the local vault.',
      },
      {
        heading: 'Retry behavior',
        body: 'An upload or API failure does not change or delete the local package. Submitting the same capture with the same visibility reuses the archive-derived idempotency key and resumes the retry-safe share job.',
      },
    ],
  },
};

export const docSubheadings: Partial<Record<DocPageKey, ReadonlySet<string>>> = {
  'hosted-credits': new Set([
    'Monthly and supplemental grants',
    'Anonymous allowances are scoped by network address',
    'An abuse control, not an identity claim',
    'Account summary',
    'Evidence is unchanged',
  ]),
  share: new Set([
    'Choose visibility',
    'Share one Sealed Trace',
    'Script-friendly output',
    'Admission checks',
    'Current consent boundary',
    'Exact package retention',
    'Retry behavior',
  ]),
};

export const docNavigation: DocNavigationGroup[] = [
  {
    label: 'Start',
    pages: [
      ['overview', 'Overview'],
      ['getting-started', 'Install options'],
    ],
  },
  {
    label: 'Understand',
    pages: [
      ['how-it-works', 'Trust model'],
      ['hosted-credits', 'Plans and usage'],
      ['trace-packages', 'Trace packages'],
    ],
  },
  { label: 'Share', pages: [['share', 'Share a Trace']] },
];
export const docAliases: Record<string, DocPageKey> = {
  install: 'getting-started',
  proxy: 'getting-started',
  captures: 'getting-started',
  providers: 'getting-started',
  credits: 'hosted-credits',
  plans: 'hosted-credits',
  harnesses: 'getting-started',
  artifacts: 'trace-packages',
  verify: 'trace-packages',
  publish: 'share',
};

export function isDocPageKey(value: string): value is DocPageKey {
  return Object.hasOwn(docPages, value);
}
