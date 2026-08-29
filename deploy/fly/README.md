# Fly.io deployment

The production deployment runs three Fly apps in `sjc`. Two 1 GB shared-CPU
API Machines and one 256 MB shared-CPU web Machine remain running continuously;
the notary Machine keeps its suspend-on-idle behavior:

```text
internet ── HTTPS ──> seal.exalto.ai
                              │
                              └── Flycast HTTP ──> llm-notary-prod-api

local proxies ── TLS:443 ──> alice.notary.exalto.ai
```

The API is private behind Flycast, so its PostgreSQL connection and intake
endpoint are never directly exposed. Fly Proxy terminates the notary's public
TLS connection and forwards the unmodified binary protocol to port 7047
through Fly's encrypted backhaul. The configuration deliberately uses the
`tls` handler only—not the HTTP handler. The custom hostname is a DNS-only
CNAME to the target reported by `fly certs setup`; its `_fly-ownership` TXT
record lets Fly issue and renew the public certificate.

The three Fly applications still carry the retired brand in their names. Fly has no
in-place application rename, so changing them means creating new applications and migrating
every secret, volume, address, and hostname — including a certificate move on the production
origin. That is tracked separately rather than bundled into the Notary rename; every other
deployment identity, including the downloads bucket, is already canonical.

The checked-in configuration targets the `llm-notary-prod` organization. Create
the three apps and provision a private Flycast address for the API before the
first deployment. Keep a private notary volume available for durable hosted
operation state that must survive restarts and Machine replacement:

```bash
fly volumes create notary_data --region sjc --size 1 \
  -a llm-notary-prod-server
```

The notary's TLS handler can use Fly's shared IPv4 routing.
Create a Neon PostgreSQL database and stage its direct connection URL as both
the `NOTARY_API_DATABASE_URL` and `NOTARY_API_MIGRATION_DATABASE_URL` Fly
secrets before deploying the API. Neon's transaction pooler does not preserve
the API's connection-scoped canonical schema selection; staging avoids
restarting the previous API revision. The API deploy runs the supplied migrator
once as Fly's release command before replacing Machines. Create a private
Tigris bucket for the API, then map its bucket, endpoint, region, and scoped
credentials to the exact `NOTARY_API_S3_*` settings. The API intentionally does
not read ambient `AWS_*` or provider-specific fallback names.

CLI archives use a separate public Tigris bucket named
`notary-prod-downloads`. The web gateway proxies `/downloads` to that
bucket's fixed public origin; do not make the private intake bucket public or
reuse either bucket's credential for the other. The GitHub `production`
environment holds the download bucket's `NOTARY_DOWNLOADS_ACCESS_KEY_ID` and
`NOTARY_DOWNLOADS_SECRET_ACCESS_KEY`. No deployed Fly app needs that
upload credential.

The API uses base64-encoded Fly file secrets for every credential and for the
canonical Registry document:

- `NOTARY_SERVER_SIGNING_KEY_B64` on the notary.
- `ADMISSION_SERVICE_TOKEN_B64` on both the API and notary. Use the same
  random value in both apps; it authenticates only the notary's narrow admission
  platform API calls and is never sent to local clients.
- `ANONYMOUS_SUBJECT_HMAC_KEY_B64` on the API only. It derives period-scoped
  opaque Public credit subjects and must be independent of the admission and
  signing keys. Increment the configured key version when rotating it.
- `NOTARY_REGISTRY_B64` on the API contains the complete versioned Registry
  JSON. This file is the only hosted Registry configuration source.
- `GOOGLE_OAUTH_CLIENT_SECRET_B64` and `GITHUB_OAUTH_CLIENT_SECRET_B64` contain
  the configured browser OAuth secrets. Their non-secret client IDs use
  `NOTARY_API_GOOGLE_CLIENT_ID` and `NOTARY_API_GITHUB_CLIENT_ID`.
- `STRIPE_SECRET_KEY_B64` and `STRIPE_WEBHOOK_SECRET_B64` contain the Stripe
  secrets when billing is enabled.

The API also needs at least one browser OAuth client and the canonical Registry
containing the notary signing-key history. Google is the primary sign-in path; stage
`NOTARY_API_GOOGLE_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET_B64` on the API and set
its Web application callback to
`https://seal.exalto.ai/api/auth/google/callback`. The requested Google scopes
are only `openid`, `email`, and `profile`. Register the matching GitHub callback
at `https://seal.exalto.ai/api/auth/github/callback`. Keep the retired
`notary.exalto.ai` callbacks registered until its redirect has been live long
enough for active sign-in attempts to complete.

These are Fly runtime secrets, not GitHub Actions secrets. Stage them before
merging so the current release is not restarted. When Google supplies a
downloaded Web-client JSON file, import only its client fields over stdin so
the secret does not appear in the process arguments:

```bash
jq -r '(.web // .installed) |
  "NOTARY_API_GOOGLE_CLIENT_ID=\(.client_id)\nGOOGLE_OAUTH_CLIENT_SECRET_B64=\(.client_secret | @base64)"' \
  /secure/path/google-oauth-client.json |
  flyctl secrets import --stage -a llm-notary-prod-api
```

Treat a client secret pasted into chat, logs, or shell arguments as compromised:
delete it in Google Cloud, create a replacement, and import only the replacement.

Create the Stripe webhook endpoint at
`https://seal.exalto.ai/api/billing/stripe/webhook` and pin it to API version
`2026-02-25.clover`. Stage its new signing secret before the API uses the Seal
origin. Subscribe only to these events:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `customer.subscription.paused`
- `customer.subscription.resumed`
- `refund.created`, `refund.updated`, and `refund.failed`
- `charge.dispute.funds_withdrawn`, `charge.dispute.funds_reinstated`, and
  `charge.dispute.closed`

Stage all five Stripe settings before enabling subscription Checkout. The
secret key, three Prices, and webhook endpoint must all use the same test or
live environment. The credit Price is a one-time $10 USD Price; the other two
are recurring monthly Prices for $9.99 and $49.99. Subscription Checkout stays
disabled until both recurring Price IDs are present. Send values over stdin so
neither secret enters shell history:

```bash
read -rs STRIPE_VALUE
printf 'STRIPE_SECRET_KEY_B64=%s\n' "$(printf %s "$STRIPE_VALUE" | base64)" | \
  flyctl secrets import --stage -a llm-notary-prod-api
read -rs STRIPE_VALUE
printf 'STRIPE_WEBHOOK_SECRET_B64=%s\n' "$(printf %s "$STRIPE_VALUE" | base64)" | \
  flyctl secrets import --stage -a llm-notary-prod-api
printf '%s\n' 'NOTARY_API_STRIPE_CREDIT_PRICE_ID=price_...' \
  'NOTARY_API_STRIPE_ONE_GB_PRICE_ID=price_...' \
  'NOTARY_API_STRIPE_TEN_GB_PRICE_ID=price_...' | \
  flyctl secrets import --stage -a llm-notary-prod-api
unset STRIPE_VALUE
```

Legacy inline Stripe settings are not read. Remove them after the file-secret
cutover so the deployment has one authoritative credential path.

The account API exposes the configured purchase mode as `disabled`, `test`, or
`live`. Verify that the dashboard hides Checkout when disabled and shows its
test-mode warning before exercising a test Price. Do not promote a test secret,
Price, or webhook endpoint into a live configuration.

Milestone 1 deliberately starts from the single `0001_initial.sql` PostgreSQL
baseline in the `notary_api` schema. It is a clean cutover, not an in-place
upgrade from prototype hosted schemas. Back up any prototype data that must be
kept, provision a fresh database, and validate the baseline before directing
traffic to this release. Keep the notary's `notary_data` volume:
`/data/usage-outbox` retains measured usage until the private settlement
endpoint acknowledges it, including across Machine restarts or platform API
outages.

Operation usage must be acknowledged in PostgreSQL or remain durably queued
under `/data/usage-outbox`; never print raw admission tickets while performing
an audit.

## One-time notary-api cutover

Milestone 1 replaces the prototype API configuration and database with one
clean canonical contract. It is not a rolling migration from the previous
schema. Enter a maintenance window and stop public routing and admission
issuance before the first canonical Machine starts. Drain legacy sessions and
usage outboxes, then provision the fresh database and stage the canonical
`NOTARY_API_*` settings and file secrets. Replace both Machines while traffic
remains stopped, or bootstrap a separate app, using a reviewed canonical image
and `deploy/fly/notary-api.fly.toml`. Verify readiness and the complete
admission/redeem/settle path, switch or resume traffic only after both Machines
are healthy, then run `bash deploy/fly/preflight-notary-api.sh`.

The preflight requires two started, healthy, digest-pinned Machines carrying
the `canonical-v1` deployment marker and at least 1 GB of memory, plus the
required database, storage, Registry, OAuth, and admission secret names.
Normal CI is therefore unable to treat a legacy image as its rollback target.
Preserve the
legacy image, configuration, and database separately for an operator-driven
cutback until the canonical bootstrap is accepted; do not point either image at
the other schema. Never bootstrap one canonical Machine alongside a routed
legacy replica: the two schemas cannot share tickets, sessions, or settlements.

Every hosted protocol connection first carries a short-lived one-time ticket
obtained from the public API. The notary redeems it through the private
`llm-notary-prod-api.flycast` origin with the `one_operation_v2` contract before
protocol work. The V2 contract creates a pending operation with a 60-second
activation window. The notary first stages that operation in its local durable
usage outbox, validates the returned limits, and only then activates it. No
protocol session starts before activation. New sessions fail closed if that
control plane is unavailable, while an activated one-operation session
continues using only local notary limits and timeouts. Public and signed-in Free
sessions share this path; their credit subjects determine which grants fund
capture and notarization.
At the end of the operation, the notary reports the redeemed operation ID,
mode, terminal outcome, instance, and authoritative authenticated bytes through
the same service-authenticated private API. The redeem request advertises this
durable-settlement capability so an older notary cannot leave an operation row
that it does not know how to settle during an API-first rollout. The reusable
browser/CLI credential and raw admission ticket stay out of that report.

Preserve the existing Registry history so notarized packages continue to use
the same timestamp-scoped trust history. Ongoing PostgreSQL and Neon operations
are documented in [Database operations](../../docs/database-operations.md).

Clients fetch the Registry over authenticated HTTPS and cache it by generation;
the JSON document is not separately signed. When moving its
advertised hostname, transport, port, or key set, increase
the generation inside `NOTARY_REGISTRY_B64`; reusing a generation for different
Registry contents is intentionally rejected as a rollback/conflict.

The TLS certificate authenticates the network endpoint but does not replace the
notary signing key in the Registry. A self-hosted notary can advertise either
`tcp` or `tls`; TLS termination need not be provided by Fly.

## One-time notary-server cutover

The checked-in server configuration intentionally targets the renamed
`llm-notary-prod-server` app. Normal CI refuses to deploy until that app has a
bootstrapped, digest-pinned Machine and all cutover prerequisites. Perform this
one-time setup before merging or enabling the workflow:

1. Create `llm-notary-prod-server` in the production organization and create
   its `notary_data` volume in `sjc`.
2. Re-stage `NOTARY_SERVER_SIGNING_KEY_B64` and
   `ADMISSION_SERVICE_TOKEN_B64` on the new app. Fly does not reveal existing
   secret values, so restore them from the authoritative secret manager; never
   copy them through logs or shell arguments.
3. Build one reviewed image, resolve it to a `sha256` digest, and deploy that
   digest explicitly to bootstrap the first Machine.
4. Run `fly certs setup alice.notary.exalto.ai -a llm-notary-prod-server`, add
   the reported CNAME and `_fly-ownership` TXT records, and wait for the
   certificate to report configured.
5. Run `bash deploy/fly/preflight-notary-server.sh`. It verifies the app,
   region/volume, secret names, single current digest-pinned image, and
   certificate without printing secret values.
6. Exercise the binary admission protocol against the new app's staging
   hostname. Wait for active sessions and the usage-outbox pending metric on
   the old app to reach zero, switch the public CNAME, and repeat the admission
   check through `alice.notary.exalto.ai`.

Keep the old app, volume, certificate, and DNS target intact for one rollback
window. To roll back, drain the new server, restore the old CNAME, verify its
certificate and admission path, then stop the new app. Do not destroy either
volume until its outbox is empty and the rollback window has closed.

## Seal hostname cutover

`seal.exalto.ai` is the canonical browser origin for Exalto Seal. The web
gateway keeps `notary.exalto.ai` only as a permanent path-preserving redirect;
do not point the retired hostname at a separate site.

Complete these steps before deploying a build that sets
`NOTARY_PUBLIC_ORIGIN=https://seal.exalto.ai`:

1. Run `flyctl certs add seal.exalto.ai -a llm-notary-prod-web`, then add the
   A/AAAA records (or CNAME and ownership TXT record) reported by
   `flyctl certs setup`. Wait for `flyctl certs check seal.exalto.ai` to report
   the certificate as issued.
2. Register both Google and GitHub callback URLs at
   `https://seal.exalto.ai/api/auth/{provider}/callback`. Keep the old callbacks
   registered through the redirect rollback window.
3. Create the Seal Stripe webhook endpoint, subscribe it to the same events as
   the retired endpoint, and stage its signing secret as
   `STRIPE_WEBHOOK_SECRET_B64` before the API rollout.
4. Deploy the reviewed API and web images. The existing gateway can serve Seal
   as soon as the certificate and DNS are active; the new web image then
   redirects `notary.exalto.ai` to the canonical origin.
5. Smoke-test `https://seal.exalto.ai/api/readyz`, sign in with each configured
   provider, open Account and Sealed Traces, and verify both a public Trace and
   a release download. Test one old `notary.exalto.ai` link reaches the same
   path at Seal.

## Production rollout

Production is deployed only by manually dispatching the `Deploy to Fly.io`
workflow from `main`. Supply either one exact source SHA to promote or one
successful prior workflow run ID to roll back. The workflow requires a source
SHA to be reachable from `main` and to have its own successful `Main
validation` result. It deploys the complete notary, API, and web set; there is
no component matrix and no approval or reviewer gate.

Fly remains the image builder and registry. The workflow uses `fly deploy
--build-only --push` to build all three images before changing any Machine and
gives each image a tag unique to the commit and workflow run. The rollout then uses
that tag to resolve an immutable `sha256` digest and deploys only the digest.
It therefore neither rebuilds nor promotes a different image:

1. Deploy the notary-server against the currently deployed dual-contract API.
   The server begins redeeming and activating V2 operations while the API still
   accepts both V1 and V2.
2. Deploy the V2-only API and check it through the still-old web gateway. Any
   release migration runs before the new API starts and must remain writable by
   the recorded rollback image.
3. Deploy the web gateway and check the public readiness route again.

Each successful run uploads one private `production-rollout.json` artifact
with its `prod-<run-id>-<attempt>` rollout ID, source SHA, immutable digest
set, migration action, timestamps, and previous digest set. GitHub's production
environment supplies secrets and creates the single deployment record, but it
has no approval protection.

The deployment preflight sends an unauthenticated request to the V2 activation
route and requires its exact `401` response before the server rollout begins.
This proves that the preceding dual-contract API release is live; a rapid stack
merge, skipped deployment, or failed prior rollout cannot jump directly from a
V1-only API to the V2-only server/API pair.

Before the first change, the workflow records every app's current Fly image.
If a deploy or compatibility check fails, it restores each attempted app in
reverse order. API rollback skips the old image's release command: PostgreSQL
migrations are forward-only and the previous API must remain usable against
the newly migrated schema. If API restoration fails, rollback deliberately
keeps the V2 server running because it is compatible with both API contracts;
it never restores the V1 server against a possibly V2-only API.

For an intentional rollback, dispatch the same workflow with a successful
prior run ID. It downloads that run's manifest and restores its exact web, API,
and notary digests in reverse rollout order using the Fly configuration from
the manifest's recorded source SHA. It never runs the recorded API's release
command and never claims to reverse database migrations. The rollback itself
produces a new successful rollout manifest.

## Landing rollout

`exalto.ai` is served by a fourth Fly app, `exalto-prod-landing`, built from
`platform/landing` by `deploy/fly/landing.{Dockerfile,fly.toml}`. It is a
static Vite build served by Caddy with no runtime dependency on the API, so it
is deliberately kept outside the promotion above: a marketing copy change must
not wait on a validated API promotion, and an API rollback must not revert the
public site. The `production-rollout.json` contract therefore still records
exactly the notary, API, and web digests.

The `Deploy landing` workflow runs on every push to `main` that touches
`platform/landing/**` or the landing Fly files, and can also be dispatched
manually. It follows the same build discipline as the promotion: build with
`fly deploy --build-only --push`, resolve the tag to an immutable `sha256`
digest, deploy only that digest, and record the previous digest so a failed
rollout is restored. The copy audit runs inside the image build, so a banned
term fails the build before any Machine changes. On a pull request the same
audit runs in the `Landing site` CI job.

Serve checks run against `https://exalto-prod-landing.fly.dev` rather than the
public hostname so a rollout is verified before `exalto.ai` DNS exists and
keeps being verified afterwards.

The app is created once, by hand:

```bash
flyctl apps create exalto-prod-landing
flyctl ips allocate-v4 --app exalto-prod-landing
flyctl ips allocate-v6 --app exalto-prod-landing
flyctl certs add exalto.ai --app exalto-prod-landing
flyctl certs add www.exalto.ai --app exalto-prod-landing
```

`exalto.ai` is an apex name, so unlike every hostname above it cannot be a
CNAME. It needs `A` and `AAAA` records pointing at the addresses reported by
`flyctl ips list --app exalto-prod-landing`, and the dedicated IPv4 is
required because a shared address cannot carry an apex certificate. Create a
deploy token scoped to the app and store it as the `FLY_LANDING_DEPLOY_TOKEN`
repository secret:

```bash
flyctl tokens create deploy --app exalto-prod-landing --name github-landing-deploy
```

### Rolling compatibility contract

Every production change must support the mixed versions that can exist during
a rolling deployment and its rollback:

- a new notary continues accepting the control protocols used by the current
  and immediately previous clients;
- the API works with both the current and immediately previous notary and web
  contracts;
- the web gateway works with both the current and immediately previous API;
- Fly environment/configuration changes remain valid for the previous image;
- database changes use expand/contract migrations: add compatible schema
  first, stop using old schema in a later release, and remove it only after at
  least one further release has made rollback to the old use impossible.

Breaking any of these contracts requires an explicitly staged multi-release
migration. Do not merge an incompatible change and rely on deployment order to
hide it.

For a break-glass, operator-driven deployment from the repository root, use the
same build-then-deploy split and retain the previous image references for
rollback. For this V2 cutover, deploy the notary-server first and the API
second, as the workflow does. Roll back the API to its dual-contract image before rolling
the server back to V1.
Normal production changes must go through the manual Actions workflow. For a
break-glass reconstruction of the same steps:

```bash
label="manual-$(git rev-parse --short=12 HEAD)-$(date -u +%Y%m%d%H%M%S)"
fly deploy --build-only --push --image-label "$label" -c deploy/fly/notary-server.fly.toml
fly deploy --build-only --push --image-label "$label" -c deploy/fly/notary-api.fly.toml
fly deploy platform/web --build-only --push --image-label "$label" \
  -c "$PWD/deploy/fly/web.fly.toml"

fly auth docker
notary_api_image="registry.fly.io/llm-notary-prod-api@$(bash deploy/fly/resolve-image-digest.sh "registry.fly.io/llm-notary-prod-api:$label")"
notary_server_image="registry.fly.io/llm-notary-prod-server@$(bash deploy/fly/resolve-image-digest.sh "registry.fly.io/llm-notary-prod-server:$label")"
web_image="registry.fly.io/llm-notary-prod-web@$(bash deploy/fly/resolve-image-digest.sh "registry.fly.io/llm-notary-prod-web:$label")"

bash deploy/fly/preflight-notary-api.sh
fly deploy --image "$notary_server_image" \
  --ha=false -c deploy/fly/notary-server.fly.toml
fly deploy --image "$notary_api_image" \
  --ha=true -c deploy/fly/notary-api.fly.toml
fly deploy platform/web --image "$web_image" \
  --ha=false -c "$PWD/deploy/fly/web.fly.toml"
```

Fly's registry can briefly return `not found` after a successful manifest
push. CI waits for each labeled image to become visible, validates its digest,
and only then records the digest-pinned references used for rollout. If a
digest never becomes visible within the bounded retry window, the deployment
stops before changing any Machine.

The web Machine and both API Machines stay running to avoid request cold starts
and keep background work prompt. The notary remains suspendable and Fly starts
it when a protocol connection arrives. API readiness is `/api/readyz`, which
verifies the shared database connection. Every API Machine runs the cleanup and
admission workers; PostgreSQL claims prevent duplicate admission and metadata
generation. Add capacity with `fly scale count <n> -a llm-notary-prod-api`,
keeping the total configured database pool size within the Neon connection
budget.

The notary's 30-second Fly stop timeout contains the 15-second shared-server
drain and the platform adapter's final 10-second settlement flush. Keep those
budgets bounded and leave headroom for process startup and task-group teardown.

## Metrics

Fly scrapes the API's private `:8080/metrics` endpoint and the notary's
private `:9090/metrics` endpoint every 15 seconds. The web gateway is covered
by Fly's built-in proxy metrics. These are available in the managed Grafana
instance and through Fly's Prometheus-compatible API, which retains roughly 15
days of operational data.

Create a short-lived, read-only organization token before querying the API;
do not use a deploy token or commit this token to an environment file:

```bash
fly tokens create readonly --org <org-slug> --expiry 1h --name notary-metrics
```

With that token in `FLY_METRICS_TOKEN`, query
`https://api.fly.io/prometheus/<org-slug>/api/v1/query` using the
`Authorization: FlyV1 <token>` header. Useful MetricsQL/PromQL expressions:

```text
# Fly edge response rate by status for the public gateway.
sum(rate(fly_edge_http_responses_count{app="llm-notary-prod-web"}[5m])) by (status)

# p95 API handler latency by route (application time, excluding Fly routing).
histogram_quantile(0.95, sum(rate(notary_api_http_request_duration_seconds_bucket{app="llm-notary-prod-api"}[5m])) by (le, route))

# Trace-verification backlog and age of its oldest item.
max(notary_api_trace_verification_queue_depth{app="llm-notary-prod-api"})
max(notary_api_trace_verification_oldest_queued_seconds{app="llm-notary-prod-api"})

# Trace-verification outcomes and p95 verification time.
sum(increase(notary_api_trace_verifications_total{app="llm-notary-prod-api"}[1h])) by (outcome)
histogram_quantile(0.95, sum(rate(notary_api_trace_verification_duration_seconds_bucket{app="llm-notary-prod-api"}[15m])) by (le, outcome))

# Raw TCP demand plus active notary protocol sessions.
sum(increase(fly_edge_tcp_connects_count{app="llm-notary-prod-server"}[5m]))
sum(notary_server_active_sessions{app="llm-notary-prod-server"}) by (mode)
```

The binaries can also export OTLP traces when an
`OTEL_EXPORTER_OTLP[_TRACES]_ENDPOINT` is configured, but Fly's managed
service is not an OTLP trace backend. Point that setting at a separate
OpenTelemetry Collector/Tempo-compatible backend if distributed traces are
needed.
