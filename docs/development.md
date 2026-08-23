# Development and validation

This guide covers repository layout, generated contracts, test tiers, and the
documentation update rules that protect Notary's trust boundaries.

## Workspace map

| Path | Responsibility |
| --- | --- |
| `runtime/` | self-contained public Cargo/frontend workspace, docs, tests, containers, and vendored dependencies |
| `runtime/crates/notaryd/` | local proxy, catalog, vault integration, REST API, clustered operation, and embedded dashboard |
| `runtime/crates/notaryctl/` | thin localhost REST command client |
| `runtime/crates/notary-updater/` | signed-update verification shared by CLI and desktop |
| `runtime/crates/notary-core/` | Proxy-TLS protocol, evidence contracts, normalization, trust directory, and verification |
| `runtime/crates/notary-server/` | public ticketless remote notary runtime and generic admission/lifecycle seam |
| `runtime/apps/admin-dashboard/` | independently locked dashboard source, generated local API, tests, and assets |
| `platform/crates/notary-server-platform-adapter/` | private platform ticket redemption, durable usage outbox, and settlement policy |
| `platform/crates/notary-api/` | hosted API, identity, admission tickets, sharing, verification, public Traces, and billing |
| `platform/migrations/` | forward-only hosted schema migrations |
| `platform/web/` | private platform website |
| `compose.yml`, `deploy/`, `.github/workflows/` | containers, production deployment, and CI |

Treat `runtime/vendor/` as third-party code. Change it only when the protocol requires
the patch, keep the diff narrow, and explain the divergence in the corresponding
vendor README or change description.

## Toolchains

- Rust is pinned to 1.95.0.
- The JavaScript CI uses Node.js 24 and `npm ci`.
- PostgreSQL integration tests use disposable PostgreSQL 17.7 containers.
- Dashboard screenshot generation uses Playwright Chromium.

Install JavaScript dependencies only when working on the site, dashboard,
generated API clients, or their documentation:

```bash
npm --prefix platform/web ci
npm --prefix runtime/apps/admin-dashboard ci
```

## Generated API contracts

Both Rust routers generate OpenAPI 3.1. The TypeScript clients are generated
from committed contract copies.

```bash
npm --prefix runtime/apps/admin-dashboard run generate:api
npm --prefix platform/web run generate:platform-api
```

Use the check forms in CI or before review:

```bash
npm --prefix runtime/apps/admin-dashboard run check:api
npm --prefix platform/web run check:platform-api
```

Do not hand-edit files under either `generated/` directory. When a route,
method, status, field, or authentication rule changes, update the Rust schema,
regenerate the contract and client, then update prose examples in the same
change.

## Required checks

Run the checks relevant to edited code:

```bash
cargo fmt --check
cargo fmt --manifest-path runtime/Cargo.toml --check \
  -p notary-core -p notaryd -p notaryctl \
  -p notary-updater -p notary-server
cargo clippy \
  -p notary-api \
  -p notary-server-platform-adapter \
  --all-targets --all-features -- -D warnings
cargo clippy --manifest-path runtime/Cargo.toml \
  --workspace --all-targets --all-features -- -D warnings
cargo test \
  -p notary-api \
  -p notary-server-platform-adapter \
  --all-targets --all-features
cargo test --manifest-path runtime/Cargo.toml \
  --workspace --all-targets --all-features
npm --prefix runtime/apps/admin-dashboard run build
npm --prefix platform/web run build
npm --prefix runtime/apps/admin-dashboard run test
npm --prefix platform/web run test:site
npm --prefix runtime/apps/admin-dashboard run check:local-docs
```

Ordinary tests must remain deterministic and offline. They do not need a
provider credential, hosted account, production notary, or external database.

## Optional integration and profile tests

The PostgreSQL-backed API tests need a running Docker daemon and create their
own disposable database:

```bash
cargo test -p notary-api \
  device_refresh_rotation_records_replay_and_revokes_the_chain -- --ignored
cargo test -p notary-api \
  web_users_can_list_and_revoke_only_their_devices -- --ignored
cargo test -p notary-api \
  admissions::tests -- --ignored
```

Large proof and real-provider checks are opt-in. The
`proxy_tls_split_profile` test measures the production split process against a
separate notary container without making a billable inference. Use
`notary-server serve --profile-sessions` only in an isolated Linux cgroup with one measured session
at a time.

The manual `Runtime resource profiles` workflow owns the fixed 15 MiB JSON
stack profile, 64 KiB local Proxy-TLS profile, and 32,768-token split profile.
The non-blocking `S3 storage canary` workflow owns the real presigned-upload
round trip. It runs only with dedicated `NOTARY_CANARY_S3_*` repository
secrets and variables; scheduled runs report a notice and skip until that
isolated bucket is configured. Neither workflow is a merge or release gate.

## Container validation

For Compose or deployment changes, run the digest-resolution test and validate
Compose with placeholder secrets. Never use real credentials in a validation
command that can enter logs or shell history.

```bash
bash deploy/fly/test-resolve-image-digest.sh
docker compose --env-file /path/to/placeholder.env config --quiet
```

Run the complete local-daemon persistence test with no arguments:

```bash
runtime/test-daemon-persistence-e2e.sh
```

Pass `smoke` for the shorter recovery check. The explicit matrix form remains
available to CI and later storage backends:

```bash
runtime/test-daemon-persistence-e2e.sh smoke
runtime/test-daemon-persistence-e2e.sh sqlite filesystem 1 full
runtime/test-daemon-persistence-e2e.sh sqlite s3 1 smoke
runtime/test-daemon-persistence-e2e.sh sqlite s3 1 full
runtime/test-daemon-persistence-e2e.sh postgres filesystem 1 smoke
runtime/test-daemon-persistence-e2e.sh postgres filesystem 1 full
runtime/test-daemon-persistence-e2e.sh postgres s3 1 smoke
runtime/test-daemon-persistence-e2e.sh postgres s3 1 full
runtime/test-daemon-persistence-e2e.sh postgres s3 2 full
```

The smoke test builds and launches the real `notaryd` and `notaryctl`
binaries in Docker without publishing either loopback listener. It initializes
the vault and schema, checks `/healthz`, and runs the REST-backed command client.
It then uses deterministic synthetic rows and deliberately invalid encrypted
checkpoint bytes to exercise filesystem recovery, catalog search/detail,
notarization enqueue and bounded failure history, events, SQLite integrity,
and preservation of exact artifact bytes after the daemon container is removed
and recreated with its durable volume.

The S3 entries add pinned MinIO server and client containers, create a bucket
inside the Compose project's disposable volume, and use explicit synthetic
credentials. The generated daemon configuration enables path-style access and
the fixed `daemon-e2e/artifacts` prefix; insecure HTTP is enabled only for this
internal MinIO endpoint. The harness verifies that deferred captures and
notarized packages use the configured prefix and private namespace, survive
daemon recreation, and complete the same capture, list/detail, notarization,
download, verification, and exact-byte sharing path as filesystem storage.
Both ordinary JSON responses and OpenAI-style SSE streaming responses traverse
the real proxy/notary fixture, produce notarized packages, and upload those
exact verified bytes to a loopback-only hosted-share fixture with a synthetic
API key.

The two-replica row uses PostgreSQL 17 and MinIO behind a health-aware Caddy
frontend with retries and buffering disabled. It verifies distinct replica
incarnations, cross-replica dashboard sessions, fenced notarization ownership,
cross-replica capture/package access, and safe peer removal.

S3 recovery coverage includes a metadata row whose object is missing, a
same-size object whose digest does not match its metadata, and a package that
was published before the daemon was killed but whose metadata transaction was
not completed. The first two must fail closed; retrying the last case must
reuse the exact immutable object. The harness also stops MinIO beneath the
running daemon and checks that `/healthz` remains live while `/readyz` and
`/v1/status` return `503`, then verifies readiness recovery. Object-size
rejection and a conflicting same-key write are exercised by the artifact-store
tests rather than this daemon harness because the public daemon API does not
expose a safe way to inject either condition. Do not substitute a
successful-looking fixture for those remaining end-to-end cases.

At the end of every matrix row the harness stops the daemon and runs the
shipped `reconcile-artifacts` command. Filesystem rows must report every
reference verified. S3 rows must inventory the complete managed prefix and
report the deliberately corrupt reference without printing keys or deleting
objects.

The PostgreSQL entries launch `postgres:17.7-alpine` with a project-scoped data
volume and run the shipped daemon's one-shot `migrate` subcommand before
starting the service. The harness proves that runtime refuses an unmigrated
schema and an unavailable database, applies the migration twice to check
idempotency, and then runs the same REST, restart, artifact, and full Proxy-TLS
assertions as SQLite. It also stops PostgreSQL beneath a running daemon and
checks that `/healthz` remains live, `/readyz` returns `503`, and readiness
recovers after the database restarts. Runtime receives only
`NOTARYD_METADATA_DATABASE_URL`; the one-shot migrator receives only
`NOTARYD_METADATA_MIGRATION_URL`. The daemon never applies PostgreSQL schema
changes during normal service startup.

Set `DAEMON_E2E_POSTGRES_SCENARIOS=extended` on a PostgreSQL matrix entry to
also run two migrators concurrently and hold the migration advisory lock long
enough to verify the configured lock timeout. Database names, roles, and
passwords in this Compose file are fixed synthetic fixtures on an internal-only
network. This fixture explicitly sets `ssl_mode = "disable"`; production keeps
the secure TLS default. Never reuse these settings outside the disposable E2E
project.

The full profile also creates an ephemeral private CA and provider certificate
inside the Compose project's disposable volume, starts a TLS provider on the
`api.openai.com` Docker network alias, and starts the feature-gated raw notary
fixture. It exercises a successful Proxy-TLS capture, REST-backed list and
detail, notarization, exact package download, daemon and file verification, and
package recovery after container recreation. The provider request and response
are fixed synthetic JSON and no external provider is contacted.

The full profile also pauses one notarization immediately after immutable
package publication, kills the daemon, and checks that startup marks the first
attempt interrupted. Retrying must reuse the exact package inode and SHA-256,
produce one completion event, and notarize a second attempt without replacing
the orphaned bytes.

The private root hook is compiled only into the `daemon-e2e` image and is used
only when `NOTARYD_E2E_ROOT_CA_DER` explicitly names a regular DER
file. The production `daemon` image is built without that feature, ignores the
E2E variable, retains Mozilla/WebPKI roots, and keeps the fixed provider
allowlist. The generated CA private key and captured artifacts live only in the
unique Compose project and are deleted with its volumes. The request uses a
fixed, clearly synthetic test credential; never substitute a real key.

## Frontend source and embedded output

The hosted SPA is split by domain under `platform/web/src/site/`, with
`platform/web/src/main.tsx` as the application entry point. The public runtime
dashboard lives independently under `runtime/apps/admin-dashboard/`.

`runtime/crates/notaryd/dashboard/` is intentionally committed build
output. `notaryd` embeds that directory with `RustEmbed`, while source
installs, release builds, and desktop sidecar builds can invoke Cargo without
Node. After changing the local dashboard, run
`npm --prefix runtime/apps/admin-dashboard run build` to regenerate the embedded
files; do not edit them by hand.

## Documentation sources

Keep each surface focused:

- `README.md` is the short project entry point.
- `docs/` contains durable hosted-product, operator, and contributor guides,
  including the component/route map and documentation coverage checklist.
- `runtime/README.md` and `runtime/docs/` are the independently publishable
  runtime entry point and full public-runtime references.
- `platform/web/src/site/PublicDocs.tsx` contains the shorter public-site documentation journey.
- `platform/web/public/llms.txt` is the machine-readable public documentation index.
- generated OpenAPI is the exact route and schema authority.
- `AGENTS.md` contains repository constraints for coding agents.
- `DESIGN.md` contains the UI language and content rules.

When behavior changes, update every affected surface. In particular:

| Change | Documentation that must move with it |
| --- | --- |
| CLI command or exit code | README quick path, local-service guide, agent playbook, public docs |
| REST route or schema | OpenAPI annotations, generated clients, local-service guide, contract check |
| Artifact or disclosure rule | core producer and verifier, artifact guide, architecture, share admission |
| Notary trust policy | architecture, key lifecycle, local service, hosted public copy |
| Deployment or migration order | Fly guide, database guide, workflow comments |
| Runtime or desktop release | release runbook, desktop guide, getting started, workflow comments, public download copy |
| Dashboard workflow | dashboard guide, screenshots, fixture, browser tests |
| Hosted route or flow | generated hosted OpenAPI, hosted-platform map, focused account/billing/share guide, public copy when user-visible |
| Repository boundary or path | both READMEs, development map, public source-install copy, boundary check, CI/release paths |

Run both documentation contract checks after prose changes:

```bash
npm --prefix runtime/apps/admin-dashboard run check:local-docs
npm --prefix platform/web run check:docs
```

They check local and hosted API coverage, contract terms, source-repository and
workspace boundaries, screenshot references, obsolete commands or claims,
relative links, and exact trailing newlines.

## Dashboard screenshots

Committed dashboard images use synthetic fixtures and a fixed clock. Regenerate
them only after a dashboard change:

```bash
npx --prefix runtime/apps/admin-dashboard playwright install chromium
npm --prefix runtime/apps/admin-dashboard run capture:dashboard-docs
npm --prefix runtime/apps/admin-dashboard run check:local-docs
```

Review every generated image for sensitive data and layout regressions before
committing it.

## Sensitive data

Never commit or log:

- provider credentials or cookie values;
- notary private keys or admission service tokens;
- database URLs, presigned storage URLs, or `.env` files;
- `.llmcapture` files, vault keys, decrypted checkpoints, or raw captures; or
- request and response bodies from real users.

Fixtures must be synthetic and deterministic. Errors, events, metrics, and
operational spans use bounded safe codes and metadata only.

## Releases

Runtime and desktop publication is manual and independent of hosted deployment.
See [Runtime releases](releases.md) for version ownership, workflow setup,
publication, download routing, verification, and recovery.
