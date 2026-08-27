# Exalto Capture desktop app

Exalto Capture is the guided macOS application for capturing local AI traces,
reviewing what the current sealed package can disclose, and sending them to Exalto Seal or another
compatible notary for sealing and verification. It packages setup,
service controls, and the local Trace workspace in one native application.
Normal use does not require a separate browser window.

The public product language and workflow follow [exalto.ai](https://exalto.ai/):

1. **Capture** an AI request and response privately on this Mac.
2. **Review** what the current sealed trace can disclose.
3. **Seal** it with Exalto Seal or another compatible notary.
4. **Verify or share** the portable `.llmtrace`.

Capturing and sealing do not publish a trace. Sharing is always a later,
explicit action.

This build reviews and seals the disclosure produced by the current runtime
policy, and it uses the notary pinned by runtime configuration. Line-level
disclosure choice and an end-user notary selector remain follow-up work.

## Install

The current app requires an Apple silicon Mac, M1 or newer, running macOS 12
Monterey or later.

1. Choose the macOS download on [exalto.ai](https://exalto.ai/).
2. Open the downloaded DMG.
3. Move the application to Applications, then launch it.

The installed bundle, window, macOS application menu, status menu, and in-app
product name are all Exalto Capture. Production downloads are signed with a
Developer ID certificate, notarized by Apple, and stapled for offline
Gatekeeper checks.

## What the app does

Exalto Capture supervises the bundled `notaryd` process, exposes capture status
from the macOS menu bar, and embeds the local workspace in its native window.
The primary navigation contains only:

- **Capture**, for starting and stopping private local capture.
- **Traces**, for reviewing, sealing, verifying, exporting, and sharing traces.
- **Settings**, with Preferences, AI connections, and Activity log sections.

Trace Catalogue is a separate external destination. It is not presented as a
fourth local workspace.

The Capture screen combines service startup and capture enablement in one
action. It shows `REC · Capturing` only after the service is running and the
daemon-owned capture setting is on. When capture is off, the fixed loopback
provider routes can still send requests directly to their providers, but those
requests create no capture, no trace, and no evidence that can be sealed later.

The screen also shows the Capture, Review, Seal, Verify or share workflow,
private trace counts, local protection, configured sealing-service state, and a trust
boundary. The selected sealing service witnesses encrypted protocol traffic. It does not
receive the prompt, response, or provider credential in plaintext.

The visual system uses the live site's exact paper, card, ink, navy, blue,
green, phosphor, and REC red color roles. It uses the macOS system sans-serif
family for display and body copy, with the system monospace family reserved for
keys, commands, IDs, endpoints, and paths. Trace transcripts use restrained
green human and blue model attribution drawn from the site's authorship ledger.

Closing the window removes the app from the Dock and leaves the status-menu
controller running. Opening Exalto Capture from that menu restores the regular
window. Quitting asks a daemon started by the app to stop accepting new work,
waits for open response streams and active sealing work to finish, and then
exits. It does not force-kill a draining service solely because shutdown takes
longer than expected.

After onboarding, later launches start the bundled service automatically for
Keychain vaults and previously created empty-passphrase compatibility vaults.
A protected passphrase vault opens locked and starts the service only after the
user unlocks it. Starting the service does not turn capture on.

The provider proxy listens on the fixed loopback address `127.0.0.1:8787`.
The local administration API and embedded workspace use `127.0.0.1:8788`.
The desktop content security policy permits that exact local frame and does
not permit arbitrary remote pages.

## Six-stage onboarding

First run detects the local vault and service state before changing anything.
It then guides the user through six stages:

1. **Welcome** introduces the local-first proof workflow and its limitations.
2. **Protect private traces** uses macOS Keychain by default, with passphrase
   protection as an advanced option.
3. **Choose a sealing service** recommends Exalto Seal and explains what the service
   can and cannot see. Alternate compatible-notary configuration remains
   administrator-managed in this build.
4. **Connect an AI tool** starts with Codex CLI, Claude Code, or an API and SDK
   client.
5. **Capture a disposable trace** temporarily enables capture, provides one
   low-cost test prompt, checks that the expected new trace appeared locally,
   and restores the user's previous capture setting before leaving the step.
6. **Ready** offers an optional Exalto account, then opens Capture or Traces.

Each disposable test generates a fresh 96-bit marker. The prompt follows this
shape:

```text
Reply with exactly: EXALTO-CAPTURE-TEST-<24 uppercase hex characters>
```

Each preparation has an owner-scoped native lease tied to the current setup-window
generation before service startup begins. Switching to Terminal leaves the test
active so a CLI command can run. Closing setup or quitting atomically stops new
leases, snapshots the current owner, invalidates that generation, and restores
only the matching lease. Explicit reopen permits new leases after an abandoned
quit has finished. Late provider responses cannot end a later test or update its
UI. Local-service lifecycle operations are serialized, and a stale child exit
cannot clear a newer supervised service.

Before changing an off setting for this test, the native app writes a private
recovery marker next to its existing desktop setup markers. It clears that
marker only after capture is confirmed off again. Closing setup, quitting, or
relaunching after an interrupted test therefore retries the restore. On recovery,
the supervised local service persists capture off before binding either listener.
If a passphrase vault is still locked or the service is absent, the app may close
or quit while preserving the marker for the next unlocked launch. The app never
temporarily enables capture on a service started outside Exalto Capture.

For Codex CLI, Claude Code, and client-managed API keys, the check requires a
trace ID that was not present before the test, the expected provider, a
captured or sealed state, a successful 2xx provider response, and the exact
marker in the response preview. The native layer reads full details only for
plausible new candidates and returns only the matching trace ID to the webview.

For a Keychain-managed provider key, the app runs the disposable request
natively. The provider key and scoped local token never enter the webview or a
generated terminal command. The native request is limited to the selected
provider's fixed loopback route, disables redirects and inherited proxies, and
returns only status fields plus a trace ID that the local metadata path confirms
against the pre-request baseline, provider, successful state, and exact marker.
The response header alone is not accepted. The provider response body does not
enter the webview. The user can skip either test if they are not ready to spend
provider usage.

Local capture can work before an Exalto account is connected. The Capture
screen warns the user not to rely on new evidence when no sealing service is reachable.

## AI connections

Connection setup is client-first. A developer first chooses the tool they
already use. Provider-specific routes appear only for API and SDK clients.

Current direct client support is:

- **Codex CLI** uses the ChatGPT sign-in already saved by Codex CLI through the
  local `/codex` route. Exalto Capture changes the named base URL, not the
  saved login or model selection.
- **Claude Code** uses the claude.ai sign-in already saved by Claude Code
  through the local `/anthropic` route. The setup command removes API-key
  overrides so Claude Code can use that saved sign-in.
- **OpenAI, Anthropic, and OpenRouter API or SDK clients** use their fixed local
  provider route and either a Keychain-managed provider key or an environment
  key supplied by the originating client.

Native Claude Desktop cannot currently use the required loopback route. Codex
desktop is not yet an end-to-end supported capture client. xAI and Grok remain
marked Not yet supported until a fixed xAI route and validation path exist.
Setup links to the official xAI API-key guide without implying that Grok
capture works in this build.
Browser, Slack, remote, and cloud sessions run outside this Mac's loopback
proxy and are not intercepted automatically.

See [Provider and agent setup](../runtime/docs/provider-setup.md) for the exact
supported commands and configuration.

## Provider API keys

For OpenAI, Anthropic, and OpenRouter, onboarding offers two per-client
authentication paths. They can coexist until the saved path is removed.

### Use a scoped local token

The password field is not held in React state and is cleared before the native
import begins. The native layer validates the candidate key directly with the
selected provider over HTTPS. Redirects are disabled. A key is saved only
after the provider accepts it.

For each accepted provider key, Exalto Capture generates a separate,
unguessable local access token. Both values are stored in macOS Keychain. The
real provider key is passed to the supervised local service through a bounded,
anonymous standard-input channel and retained only in daemon memory while the
service runs.

The developer can copy the scoped local access token into the provider's normal
API-key variable or request header for their own client. The onboarding test
uses it only in native memory, so its validation cannot accidentally bypass
Keychain substitution by reading a real provider key from the shell. The local
service substitutes the stored
provider key only when all of these conditions are true:

- the request uses the matching fixed provider route;
- the authoritative provider authentication header exactly equals that
  provider's local access token;
- no other request header contains a reserved local-token value; and
- the service is the process supervised by Exalto Capture.

This gate prevents another local process from using a Keychain-held provider
key merely by discovering the loopback port. A separately managed daemon
cannot receive desktop Keychain credentials, so onboarding requires
environment-key mode until that process is stopped and Exalto Capture starts
its own service.

Copying the local access token deliberately places it on the macOS clipboard.
Treat it as a secret and clear or replace the clipboard contents when setup is
complete. Removing an imported provider key also removes its local access
token and reloads the supervised service.

### Send the provider key

The existing SDK, CLI, shell, or secret manager remains the credential owner.
The client sends the real provider key with its request to the fixed loopback
route. Exalto Capture does not store a separate Keychain copy in this mode.
A provider key imported earlier remains available through its scoped local
token until the user removes it explicitly. Choosing this client path does not
silently delete or disable the saved path.

In both modes, provider keys are excluded from app configuration, process
arguments, logs, activity events, previews, iframe messages, analytics, and
browser storage. The selected sealing service sees encrypted protocol records, not the
provider key in plaintext.

These guarantees do not mean the local private capture is credential-free.
The local daemon must construct the authenticated provider request. Its
vault-encrypted `.llmcapture` checkpoint can reconstruct the original request,
including credential-bearing header bytes. Treat every `.llmcapture` as a
secret: do not inspect, upload, log, or share it.

## Private capture and sealed disclosure

The app presents two different artifacts with different security boundaries:

- `.llmcapture` is encrypted private retry state. It can contain the complete
  provider exchange, including credential-bearing bytes, and is never the
  portable artifact to share.
- `.llmtrace` is the sealed, independently verifiable package. It contains a
  selective disclosure of authenticated HTTP data. Request and response
  bodies remain disclosed, while non-structural HTTP header values are hidden.
  A secret included in a request or response body can therefore remain in the
  local `.llmtrace`. Review the disclosure before exporting or sharing it.

Hosted verification and sharing apply additional public-safety checks that
reject credential fields, signed credential queries, known secret patterns,
and other unsafe disclosure shapes. Those checks do not turn an unreviewed
local package into a generally safe public artifact.

The selected sealing service relays encrypted TLS records and completes proof work. It
learns the provider hostname, ciphertext sizes, timing, and protocol metadata,
but not application plaintext. Sealing later creates the selective disclosure,
verifies it locally, and writes the deterministic `.llmtrace` without
consuming the source `.llmcapture`.

Local catalog previews and Activity are deliberately bounded. They do not
include raw headers, credential values, vault material, or decrypted capture
checkpoints. Retained prompt and response previews are stored in local metadata
for browsing and are not protected by the private-capture vault. Settings
shows the configured character limit. Setting that limit to zero disables
retained previews and automatic disposable-marker confirmation. These values
are local observations, not cryptographic claims.

## Connect an Exalto account, optional

After the local service starts, onboarding offers an optional hosted-account
connection. The approval page opens in the system browser, so the desktop
window never handles the hosted sign-in password. This account flow is
separate from model-provider credential setup.

Skipping account connection does not prevent local capture or verification.
Connecting an account does not upload or share local traces. It authorizes only
the hosted features the user later chooses to invoke.

Settings shows the same account connection card after onboarding. It identifies
the connected account and sign-in provider, device or hosted API-key mode,
plan and billing state, and available capture and sealing credits. Account,
usage, pricing, and settings actions open only validated links returned by the
local service in the default browser. A browser-approved device session can be
disconnected from Settings. A hosted API key must instead be managed in the
hosted account settings and is never revoked by the local app.

## Share a sealed trace

**Share** is a secondary action inside one sealed trace. Capturing, Captured,
failed, and Sealing traces are not eligible. If no Exalto account is connected,
Share keeps the same trace open while the user completes browser approval.
Connecting alone uploads nothing.

Before upload, the app renders the disclosed conversation and tool content
from the exact `.llmtrace` package, never from the private `.llmcapture`
checkpoint. The user chooses Unlisted or Listed visibility, an optional
password, and an optional expiration before confirming **Share trace**.
Unlisted is link-accessible, not private.

Verifying, Shared, Stopped, Rejected, and Sharing failed states remain inline
on the originating trace. A successful share exposes **Copy link**,
**Open shared trace**, **Manage access**, and **Stop sharing**. Access changes
reuse the canonical link. Stopping sharing makes that link unavailable without
deleting the local trace or changing its sealed state.

## Settings, AI connections, and Activity

Settings contains three sections in a compact subnavigation:

1. **Preferences** contains Connections, Privacy & storage, App, and Advanced.
   It shows account and notary state, vault protection, launch at sign-in,
   signed updates, listener and build facts, and the generated OpenAPI link.
2. **AI connections** puts Codex CLI and Claude Code first, then lists fixed API
   and SDK routes with their allowed hosts, local base URLs, readiness, capture
   state, and setup details. Model selection remains in the originating tool.
3. **Activity log** keeps severity, date, and trace ID visible. More filters
   expose operation ID and the bounded raw event name. A trace-linked event
   opens that trace; service-only events remain inspectable in Activity.

The local dashboard supplies service-backed facts. A bounded parent and frame
bridge supplies only launch and signed-updater state and accepts only those
desktop actions. Vault keys, provider API keys, and local access tokens do not
cross that frame.

## Menus

The macOS status menu provides:

- Open Exalto Capture
- Start capturing or Stop capturing
- Settings…
- Quit Exalto Capture

The application menu uses About Exalto Capture, Settings…, Hide Exalto Capture,
and Quit Exalto Capture. Help provides the Exalto Capture guide, Trace
Catalogue, problem reporting, and About Exalto Capture. Standard macOS File,
Edit, View, and Window behavior remains intact.

## Automatic updates

Signed production builds check the `latest` channel shortly after launch and
about every six hours after that. A different authenticated build ID means an
update is available, even when the channel intentionally points back to an
older build. The app downloads and verifies the complete signed application in
the background. Local source builds do not contact the update service.

Exalto Capture never installs or restarts on its own. It shows **Update ready**
and keeps the verified download until the user chooses **Restart to update** in
Settings. Background checks discard a downloaded build if a newer signed
channel revision withdraws or replaces it. Restart is unavailable during an
active capture or seal.

On restart, the app authenticates `latest` again, checks activity again, asks
its managed daemon to stop accepting new work, waits for open streams and
active sealing work to finish, installs the application, and reopens it. A
daemon started outside the app is never stopped or replaced by this flow. A
protected passphrase vault reopens locked and requires the passphrase before
capture resumes.

## Private capture protection

All `.llmcapture` files are vault-encrypted before they are written. First run
selects **Use macOS Keychain** by default. macOS protects the random vault key,
and there is no separate password to remember.

The vault protects the full reconstructable `.llmcapture`, not the bounded
prompt and response previews stored in local metadata when previews are
enabled. Onboarding and Privacy settings disclose this exception so a
passphrase is not presented as protection for every local conversation byte.

Advanced options allow a passphrase instead. The passphrase is required again
when the app opens and is retained only for that app session. It is never
written to the vault configuration. New passphrase vaults include an encrypted
key check in a private sidecar next to the configuration, so the app can reject
an incorrect passphrase before starting the local service while preserving the
v1 configuration format for older readers.

New desktop vaults reject empty and whitespace-only passphrases. Older
empty-passphrase compatibility vaults remain readable so an app update does not
strand existing captures, but onboarding no longer offers or creates them.

The app unlocks the vault before launching the daemon and sends the already
unlocked key through the child's anonymous standard-input pipe. The key is not
placed in command-line arguments, environment-variable values, logs, or files.
An environment flag only tells the supervised child to read from the pipe.
Temporary key buffers are cleared when dropped.

Legacy passphrase vaults without a key check remain usable from the CLI, but
the desktop app refuses to unlock them because it cannot safely reject a typo
before starting capture. Vault migration remains a future workflow. Settings
explains this instead of silently changing protection for existing captures.

## Naming and compatibility identifiers

The visible product and macOS bundle are Exalto Capture. Compatibility-sensitive
identifiers remain unchanged so the app can reuse existing data safely:

- Tauri `productName`, macOS `bundleName`, `CFBundleDisplayName`, and visible
  menu labels are Exalto Capture.
- The application identifier remains `ai.exalto.notary`.
- The `notary-app`, `notaryd`, and `notaryctl` executable and package names
  remain unchanged.
- Existing `notary` data paths, Keychain service names, updater object names,
  internal routes, enums, and onboarding markers remain compatible. The
  updater object names are transport identifiers and are not the installed
  application name.
- An enabled legacy `Notary.plist` LaunchAgent is migrated once to
  `Exalto Capture.plist` when the app runs from `/Applications` or the current
  user's `Applications` directory. Development and disk-image launches never
  rewrite the user's launch-at-login entry.
- `.llmcapture` and `.llmtrace` extensions remain unchanged.

An existing `Notary.app` updated in place can retain its old filesystem name
because Tauri replaces the current bundle at its current path. A fresh install
uses `Exalto Capture.app`. Test the old-client update and duplicate-app path
before relying on an automatic filesystem rename for existing installations.

## Develop from source

The desktop app is built with Tauri 2 under the compatibility package and
executable name `notary-app`. The source stays portable so Windows and Linux
packaging can follow without replacing the application shell.

Install the desktop dependencies once:

```bash
npm --prefix apps/notary-app install
```

Start the Tauri development app with a debug `notaryd` sidecar:

```bash
npm --prefix apps/notary-app run tauri:dev
```

Build a release application bundle and DMG with a release sidecar:

```bash
npm --prefix apps/notary-app run tauri:build
```

The command creates the native bundle and DMG. Local builds use a Developer ID
identity and Apple notarization credentials from the environment when they are
present.

Pull requests that affect the desktop app build a debug Apple Silicon
application bundle in CI without receiving production signing credentials.
GitHub's **Desktop DMG** workflow is reserved for manual package checks and the
production publisher. Manual checks can build an unsigned preview. A successful
production publication signs, notarizes, staples, and checks the package, then
publishes the DMG and its SHA-256 checksum together with Tauri's signed
`.app.tar.gz` updater bundle. The command-line clients use the same immutable
website build. Release builds carry the shared immutable build ID. Local source
builds report `dev` and do not participate in published updates. Unsigned
preview builds carry a test build ID but have updates explicitly disabled.
Build identity alone never grants authority to follow production.

The signed workflow reads these secrets from the branch-restricted
`macos-release` GitHub environment:

- `APPLE_CERTIFICATE` and `APPLE_CERTIFICATE_PASSWORD` contain an encrypted,
  base64-encoded Developer ID Application identity and its password.
- `APPLE_SIGNING_IDENTITY` and `APPLE_TEAM_ID` select the certificate and Apple
  developer team.
- `APPLE_NOTARIZATION_KEY_BASE64`, `APPLE_NOTARIZATION_KEY_ID`, and
  `APPLE_NOTARIZATION_ISSUER_ID` provide a dedicated App Store Connect API key
  for notarization.
- `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` sign the
  updater bundle and release manifest. This key is separate from Apple's code
  signing identity and must be backed up for the lifetime of installed clients.

The sidecar preparation script asks Cargo for the active target triple and
copies the matching daemon binary to Tauri's target-specific external-binary
name. The checked-in source therefore does not assume Apple Silicon even
though macOS is the first supported package.

## Validate

```bash
npm --prefix apps/notary-app run build
npm --prefix apps/notary-app run test:browser
cargo check -p notary-app
cargo test -p notary-app
npm --prefix apps/notary-app run tauri:build:debug
```

Exercise the native lifecycle with clean config, data, and vault directories:

- Complete all six onboarding stages.
- Exercise Keychain and passphrase vault protection, including rejection of an
  empty or whitespace-only passphrase.
- Test Codex CLI and Claude Code saved-sign-in setup.
- Test one supported API provider in Keychain mode, including validation,
  local-token copy, token-gated substitution, replacement, and removal.
- Test environment-key mode without importing a second Keychain copy.
- Capture the exact disposable test trace, then review and seal it in Traces.
- Confirm the private `.llmcapture` stays encrypted and the resulting
  `.llmtrace` contains only the intended disclosure.
- Restart and stop the service, relaunch and unlock a passphrase vault, and
  confirm that quitting Exalto Capture terminates its managed child.
