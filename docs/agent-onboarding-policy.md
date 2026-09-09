# Agent onboarding and subscription linking

Official sources checked September 8, 2026. This records implementation choices
and unresolved provider approval questions, rather than a legal determination.

## Setup handoff

Detect local URL handlers, offer an app link with a prepared prompt, then offer
the same prompt to copy. Keep manual configuration last. Require the user to
send the prompt in their coding tool. App detection and successful URL dispatch
are not evidence that configuration or capture succeeded.

Supported links:

- Codex: `codex://threads/new?prompt=...`. The prompt fills the composer without
  being submitted. [Official app commands](https://developers.openai.com/codex/app/commands).
- Claude Code CLI: `claude-cli://open?q=...`. Registration occurs after the first
  interactive prompt and can be disabled. Prompt limit: 5,000 characters.
  [Official CLI links](https://code.claude.com/docs/en/deep-links).
- Claude Desktop: `claude://code/new?q=...` opens the Code composer.
  [Official desktop links](https://support.claude.com/en/articles/14729294-open-claude-desktop-with-a-link).

The implementation queries macOS Launch Services without opening applications
or reading credentials. It encodes prompt text into one query parameter and
dispatches only fixed destinations. A handler may be stale or too old; opening
errors and missing handlers leave copyable, selectable prompts available.
Prompts never include actual keys, tokens, or private captures.

## OpenAI

Codex documents subscription sign-in and `codex login --device-auth`.
Device-code login must be enabled for the account/workspace.
[Authentication](https://developers.openai.com/codex/auth).

The official app-server interface supports custom clients and managed ChatGPT
sign-in. `account/login/start` with `type: "chatgptDeviceCode"` returns a login
ID, verification URL, and user code. Codex owns credential storage and refresh.
Clients observe `account/login/completed` and can cancel a pending login. A
client must identify itself; enterprise integrations have an additional known
client registration consideration.
[App-server authentication](https://developers.openai.com/codex/app-server).

The built-in chat uses this managed app-server flow in an isolated Codex home,
using Codex’s default credential storage instead of forcing OS Keychain.
That storage may be a local `auth.json` owned by Codex, separate from the
encrypted Trace vault.
Capture displays the code and confirmed account status; it never extracts
OAuth tokens for a raw API client. Subscription requests remain Codex requests
and pass through the fixed local `/codex` capture route. External-harness setup
instead preserves the user's existing native Codex sign-in or API-key mode.

This does not make ChatGPT entitlements general OpenAI API credits or imply
OpenAI endorsement of Exalto's relay and reconstructable credential-bearing
artifacts. The reviewed documentation describes an integration mechanism, not
express approval of these artifacts. No private OAuth endpoint or third-party
client identity is reused.

## Anthropic

Anthropic expressly disallows third-party Claude.ai login and routing user
Free/Pro/Max credentials. Developers may not collect, store, or intermediate
Claude.ai credentials or session tokens. API keys or supported cloud providers
are the documented route for products using Claude capabilities.
[Authentication and credential use](https://code.claude.com/docs/en/legal-and-compliance).

That page separately permits users to authenticate in an unmodified Claude Code
binary, including certain hosted environments, subject to its conditions.
This is not permission for Exalto to collect tokens or proxy subscription
requests. Native Claude login or `claude setup-token` is not a public
third-party linking grant.
[Native authentication](https://code.claude.com/docs/en/authentication).

Therefore do not implement a Claude subscription device-code/login flow inside
Capture or prompt agents to recover saved subscription tokens. Claude can still
use its native session to configure a separate API-key CLI capture session.

## Current implementation boundary

Built-in chat owns explicitly supplied API connections through the native vault.
Its ChatGPT connection uses a separate Codex-managed login and Keychain entry.
These connections are not used to authenticate external harness requests.

Guided Codex setup prepares `exalto-capture` for the current native auth mode:
ChatGPT uses `/codex`; an API key uses `/openai/v1`. Existing credentials are not
imported into Capture. The setup assistant preserves default workflows and
asks before replacing conflicting configuration.

Claude Desktop is the preferred setup assistant. The CLI link is an explicitly
labeled fallback if Desktop is absent. Claude capture uses a separate API-key
CLI session, with separate API billing. Desktop's own conversations are not
captured. Existing low-level Claude subscription routes and historical examples
remain outside guided onboarding; availability is not provider authorization.

The existing encrypted-capture and disposable-test safeguards still apply.
The handoff carries configuration instructions, and test handoff carries only
the disposable marker and a key-free command. Capture confirms a matching
local Trace before declaring the test successful.
