# Exalto Capture desktop redesign

Status: implemented for review in the first redesign PR

Reviewed application: Notary 0.1.4, source commit `2be864...`

Product language source: [exalto.ai](https://exalto.ai/)

## Product role

Exalto Capture is the local developer application in the Exalto proof workflow:

1. **Capture** an AI request and response privately on this Mac.
2. **Review** what the current sealed trace can disclose.
3. **Seal** it with Exalto Seal or another compatible notary.
4. **Verify or share** a portable `.llmtrace`.

Capture and sealing do not publish a trace. Sharing is always a later explicit action. A trace proves the interaction it contains, never the absence of omitted interactions.

## Full 0.1.4 review

The installed 0.1.4 application and matching source were reviewed before redesign work began. The review covered first run and vault setup, Home, Traces and trace details, Providers, Activity, Settings and updates, account connection, the status menu, the application menu, Help, and stopped, capturing, sealing, sharing, and error states.

The trace lifecycle is the strongest part of the current application. Capture progress, sealing retries, local verification, export, disclosure review, Listed and Unlisted sharing, passwords, expiry, and access management should remain in one trace detail surface.

The shell around that workflow is fragmented:

- Home controls the local service, but the capture switch is hidden in Settings.
- Traces, Activity, Providers, and Settings are presented as equal destinations even though developers mainly need one workflow.
- Traces and connections become inaccessible when the local service is stopped, despite private traces remaining on disk.
- Provider route cards expose implementation detail before explaining which developer tool is being connected.
- The menu bar and Help menu do not provide a complete task path.
- Onboarding selects a provider but does not persist or validate that choice, and it does not prove that the first request was captured.

The redesign resolves the shell and first-run issues while preserving the working trace lifecycle and compatibility boundaries.

## New information architecture

| Current surface | Exalto Capture surface | Purpose |
| --- | --- | --- |
| Home | Capture | One control for starting the service and enabling capture, plus local trace status |
| Traces | Traces | Capture, review, seal, verify, export, and share |
| Providers | Settings > AI connections | Connect Codex CLI, Claude Code, or an API client |
| Activity | Settings > Activity log | Diagnostics and local service events |
| Settings | Settings > Preferences | Privacy and storage, app behavior, updates, and advanced details |
| Public traces | Public Traces | External hosted collection at `https://seal.exalto.ai/traces` |

Primary navigation is exactly **Capture**, **Traces**, and **Settings**. Public Traces remains an external utility until the local API can enumerate shared traces safely.

## Capture screen

The primary button performs the full action a developer expects:

- If the local service is stopped, start it.
- Enable capture through the local administration API.
- Show `REC · Capturing` only after both operations succeed.

The screen uses four compact, operational cues from the public site:

- A red REC state for active capture.
- A functional Capture, Review, Seal, Verify or share stepper.
- A receipt-like summary with Captured, Sealing, Sealed, and Needs attention counts.
- A trust-boundary diagram showing that plaintext stays between the client, this Mac, and the model provider, while the notary witnesses ciphertext.

Requests made while capture is off cannot be sealed later. Capture does not require an Exalto account, but the selected notary must be reachable before the user relies on new evidence.

## Visual system

The app and embedded local dashboard now share the visual language established on exalto.ai:

- The site's exact paper `#f5f3ec`, card `#fdfcf7`, ink `#1a2233`, blue `#1e4a73`, proof green `#0e8f5d`, phosphor `#35e39b`, dark band `#0c1622`, and REC red `#b3402a` roles.
- The macOS system sans-serif family for both display and body copy, with the system monospace family reserved for keys, commands, IDs, endpoints, and paths. The app ships no separate webfont payload.
- The Exalto mark and visible Exalto Capture product name.
- Receipt-like evidence summaries, numbered Capture, Review, Seal, Verify or share flows, and explicit trust-boundary diagrams.
- Blue model and green human attribution in disclosed trace transcripts, adapted from the live site's authorship ledger.
- Readable developer density in place of either microtype or oversized generic dashboard cards. Interface metadata uses an 11px floor, working controls are about 38–40px high, onboarding prose is 16px system sans, and trace evidence prose is 14.5px system sans.

The native shell is designed and visually checked at its configured 1280 × 820 window. Short onboarding steps are vertically balanced with their primary action attached to the content. The dense client setup remains top-aligned and scrollable. Capture uses its full working area for the recorder, workflow, local-trace receipt, trust-boundary map, and connection status. The embedded trace workspace defaults to a 380px list rail and uses a two-column fact ledger when space permits.

These are functional graphics rather than decoration. They help developers understand state, proof progression, and what crosses each trust boundary. AI Connections, Activity, and trace management retain their existing capabilities inside the same visual system.

## Onboarding

The first-run path has six steps:

1. **Welcome** introduces the local-first workflow and its proof limitation.
2. **Protect private traces** configures macOS Keychain by default, with passphrase protection as an advanced option.
3. **Choose a sealing service** recommends Exalto Seal, states what the service can and cannot see, and honestly labels alternate compatible-notary configuration as administrator-managed in this build.
4. **Connect an AI tool** starts with Codex CLI, Claude Code, or API and SDK clients.
5. **Capture a disposable trace** generates a fresh marker, asks the model to echo it, and verifies that a new matching trace was created.
6. **Ready** offers an optional Exalto account and hands the user to Capture or Traces.

The disposable-trace check does not accept a changed total or response header alone. Each test uses a fresh 96-bit marker and asks the model to echo it. Confirmation requires a trace ID that was not in the baseline, the expected provider, a Captured or Sealed state, a successful 2xx provider response, and the exact marker in the response preview. The native layer fetches full details only for plausible candidates and returns only the matching trace ID to the UI. The test can be skipped when the developer is not ready to spend a provider request or has disabled response previews. Every attempt has an owner-scoped native lease and setup-window generation before service startup begins. Closing or quitting atomically stops accepting new leases, snapshots the matching owner, and invalidates pending work before restoration. Explicit reopen allows new leases again only after an abandoned quit has finished. Late provider results cannot affect a later attempt. Local-service start, stop, and restart operations are serialized, and stale child-termination events cannot clear a newer supervised process. A private marker repairs an interrupted lease on the next launch, and supervised recovery persists capture off before either local listener binds. A locked vault or absent service can preserve that marker across close or quit until the next unlocked launch.

The setup is client-first because Codex CLI and Claude Code can reuse their saved product sign-ins. API and SDK users then choose the provider-specific route while leaving the key in their existing client or secret manager. Provider remains an internal routing distinction until an API client needs it.

Current direct client support:

- **Codex CLI** can use its saved ChatGPT sign-in through the local `/codex` route.
- **Claude Code** can use its saved claude.ai sign-in through the local `/anthropic` route.
- **OpenAI, Anthropic, and OpenRouter API or SDK clients** use a client-managed environment key. Setup can hold a pasted key only in memory for an optional disposable test.
- **Codex desktop** is not yet an end-to-end supported capture client.
- **Claude Desktop** cannot currently configure the required loopback route.
- **xAI and Grok** remain marked Not yet supported until an xAI route and validation path exist. Setup links to the official xAI key guide so a developer can prepare a key without implying that the route works in this build.

## API key security boundary

For OpenAI, Anthropic, and OpenRouter, the existing SDK, CLI, shell, or secret manager remains the credential owner and sends the key with the local request. Exalto Capture does not maintain a second provider credential path and does not substitute keys in the daemon.

Onboarding offers an optional fast test. A pasted provider key is held only in React memory for the current setup session and passed to one native command. The native request uses the provider's normal authentication header on the selected fixed loopback route. The key is never saved to Keychain, disk, app configuration, local browser storage, daemon state, logs, previews, analytics, or the clipboard. It is cleared when setup finishes, is cancelled, or the setup window closes.

A compatible separately launched daemon is reused. The desktop does not start a colliding instance or take ownership of the existing process. It also does not change that process's capture setting; the disposable test is available when capture is already enabled.

The vault-encrypted private `.llmcapture` can reconstruct the authenticated request, including credential-bearing header bytes. It must be treated as sensitive and must not be shared. The portable `.llmtrace` uses selective disclosure and public sharing applies additional safety checks.

The complete `.llmcapture` artifact is vault-encrypted. When retained previews are enabled, bounded prompt and response excerpts are stored separately in local metadata for browsing and are not protected by the trace vault. Onboarding and Privacy settings disclose this exception. Setting the runtime preview limit to zero disables retained previews, but also disables automatic marker confirmation for the disposable onboarding test.

Official key-creation links are opened through a fixed native allowlist rather than an arbitrary URL from the webview. Provider credentials are never sent to the sealing service.

## Naming and compatibility boundary

This release changes the visible product name to **Exalto Capture** while preserving installed identity and user data compatibility:

- Set `productName`, the macOS `bundleName`, `CFBundleDisplayName`, and visible application-menu labels to **Exalto Capture**.
- Keep bundle identifier `ai.exalto.notary`.
- Keep the `notary-app`, `notaryd`, and `notaryctl` executable and package identities.
- Keep local `notary` data paths, Keychain service names, onboarding markers, internal routes, enums, and `.llmcapture` and `.llmtrace` extensions.
- Keep existing updater object names and update-channel compatibility. Those
  transport identifiers do not control the installed bundle name.
- Safely migrate an enabled legacy `Notary.plist` LaunchAgent to
  `Exalto Capture.plist` only from a durable Applications install, leaving
  unrecognized entries and development or disk-image launches untouched.

A fresh install is named `Exalto Capture.app`. An existing `Notary.app` updated
in place can retain its filesystem path, so old-client update, duplicate-app,
autostart, and vault-access behavior still require release testing.

The hosted Public Traces destination is `https://seal.exalto.ai/traces`, the same canonical Exalto Seal origin used for hosted accounts and verification. The updater origin remains unchanged in this PR so installed clients keep a working update channel.

## Menus

Status menu:

- Open Exalto Capture
- Start capturing or Stop capturing
- Settings…
- Quit Exalto Capture

Application menu:

- About Exalto Capture
- Settings…
- Hide Exalto Capture
- Quit Exalto Capture

Help:

- Read the Exalto Capture guide
- View Public Traces
- Report a problem
- About Exalto Capture

Standard macOS File, Edit, View, and Window behavior remains intact.

## Follow-up work

The following items remain intentionally outside this PR:

- A true persisted and validated notary chooser for compatible and self-hosted notaries.
- A line-level disclosure chooser. This build can review the current disclosure and seal it, but it does not yet implement the live site's full “reveal exactly the lines you choose” interaction.
- A simpler native in-app seal and verify path, including an optional first-run action for the disposable trace.
- A shared-trace collection API before adding a local Shared or Public Traces destination.
- Direct Codex desktop support, any supported Claude Desktop route, and future provider expansion such as xAI and Grok.
- An automatic rename migration for existing `Notary.app` installations after updater, duplicate-app, autostart, and vault-access testing.
- An optional live hosted sealing check for a small disposable trace once Exalto Seal is release-ready.
