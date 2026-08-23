# Runtime releases

Notary Runtime and desktop releases are published manually through the
[`Release Runtime`](../.github/workflows/release.yml) GitHub Actions workflow.
This process is independent of the hosted Fly.io deployment: a Runtime release
does not deploy the hosted service, and a hosted deployment does not publish
client binaries.

Releases use one stable `latest` channel. They do not require a reviewer or an
environment approval after the workflow is started.

## Before releasing

Start only when the current `main` head is green and is the source that should
be released. Choose the next strictly increasing stable version in `X.Y.Z`
form. Pre-release versions and reuse of an existing version are rejected.

The repository must have:

- A `NOTARY_RELEASE_TOKEN` Actions secret whose actor can push protected
  `main`. It needs Actions read and Contents read/write access in this
  repository, plus Contents read/write access in `exalto-ai/notary-runtime`.
- A `macos-release` environment containing the Apple and Tauri signing secrets
  listed in [Desktop app](desktop-app.md#develop-from-source).
- A `production` environment containing
  `NOTARY_DOWNLOADS_ACCESS_KEY_ID` and
  `NOTARY_DOWNLOADS_SECRET_ACCESS_KEY` for the download bucket.
- Zero required reviewers on both environments. Branch or tag policies may
  still restrict where the workflow runs.

`NOTARY_PUBLIC_ORIGIN` is an optional repository variable, not a secret. It
changes the public origin compiled into clients and written into signed
manifests, and defaults to `https://notary.exalto.ai`. The workflow checks that
the configured origin is reachable, but final publication verification always
checks the production Tigris origin and `https://notary.exalto.ai`.

The release signing private key must also be backed up outside GitHub. Its
matching public key is committed at
[`runtime/config/updater-public-key.txt`](../runtime/config/updater-public-key.txt).
Losing the private key prevents installed clients from trusting future updates.

## Version ownership

The canonical Runtime version is `workspace.package.version` in
[`runtime/Cargo.toml`](../runtime/Cargo.toml). Runtime crates inherit that
version. Desktop package metadata and the Cargo and npm lockfiles must carry the
same version.

[`scripts/runtime-version.mjs`](../scripts/runtime-version.mjs) owns this
synchronization. The release workflow runs it to create a mechanical version
commit on `main`; do not prepare a release by editing the generated version
files separately. To check the current state locally, run:

```bash
node scripts/runtime-version.mjs --check
```

The version commit is expected to change only:

- `runtime/Cargo.toml` and `runtime/Cargo.lock`
- `Cargo.lock`
- `apps/notary-app/package.json` and `apps/notary-app/package-lock.json`
- `apps/notary-app/src-tauri/Cargo.toml` and `tauri.conf.json`

Every CLI binary, daemon binary, desktop package, manifest, tag, and public
source release produced by that run uses this one version.

## Run a release

Dispatch the workflow from `main`, substituting the next version:

```bash
gh workflow run release.yml \
  --repo exalto-ai/notary \
  --ref main \
  -f version=X.Y.Z
```

Watch it through completion:

```bash
gh run watch <run-id> --repo exalto-ai/notary
```

Do not merge or push another change to `main` until the **Validate and tag
release sources** job finishes. The workflow deliberately fails if `main`
advances before it has tagged the exact private and public sources. Plan for
this freeze to last up to six hours: the job may wait for both Main validation
and the corresponding public Runtime export.

The workflow performs these steps:

1. Confirms the dispatch came from the current green `main`, validates the
   version, and rejects conflicting tags.
2. Synchronizes version metadata, commits it to `main`, and waits for Main
   validation of that exact commit.
3. Waits for that commit's public Runtime export and verifies its source
   mapping.
4. Creates private tag `runtime/vX.Y.Z` in `exalto-ai/notary` and public tag
   `vX.Y.Z` in `exalto-ai/notary-runtime` at the exact corresponding commits.
5. Builds `notaryctl` and `notaryd` for Linux x86-64, Linux ARM64, macOS ARM64,
   and Windows x86-64. It also builds, signs, and notarizes the macOS ARM64
   desktop DMG and updater bundle.
6. Creates and signs the immutable release manifest and the `latest` channel
   envelope.
7. Uploads the complete immutable build, downloads it again, and verifies its
   checksums and signatures before moving either `latest` pointer.
8. Verifies both public download paths and creates the public source GitHub
   Release in `exalto-ai/notary-runtime`.

## How downloads reach the website

Release assets are uploaded with the S3 API to the public Tigris bucket
`notary-prod-downloads`. Each run writes an immutable directory:

```text
releases/builds/<build-id>/
```

Only after that directory has been publicly verified does the workflow update:

- `releases/latest`, a plain-text `<build-id> <version>` pointer used by the
  website and `install.sh`.
- `releases/channels/latest.json`, the signed channel pointer used by clients
  that can authenticate updates.

The website's Caddy gateway proxies `/downloads/*` to the public Tigris bucket.
The Download button reads `/downloads/releases/latest` without caching and
constructs the immutable DMG URL from its build ID. Moving the pointer therefore
updates the button automatically; the website does not need to be rebuilt or
deployed for a new Runtime release. The command-line installer follows the same
plain-text pointer.

The signed JSON channel is canonical for clients capable of signature
verification. The two pointers cannot be updated atomically, so such clients
must not use the plain-text pointer as their source of trust.

## Published artifacts and trust

The immutable build includes raw CLI and daemon binaries, platform archives,
the macOS DMG, the signed macOS updater bundle, checksums, signatures, and
`release.json`. The public GitHub Release records the public source tag and
release identity; binary downloads come from Tigris rather than GitHub Release
assets.

The signed `release.json` manifest binds the version and build ID to the exact
private source SHA, public source SHA, and each artifact's immutable URL, byte
size, and SHA-256 digest. The signed `latest` channel envelope binds a
monotonically increasing channel revision to that manifest. Clients remember
the highest authenticated revision they have accepted, which prevents a bucket
writer without the signing key from selecting an older release after first
contact.

These protections have distinct jobs:

- Apple Developer ID signing and notarization authenticate the installed macOS
  application.
- The Tauri signature authenticates the desktop updater bundle.
- The release and channel signatures authenticate the selected Runtime build.
- SHA-256 files detect corruption but do not independently authenticate a
  release.

Keep the release bucket and its upload credentials separate from private Trace
intake. No deployed application needs the bucket's write credentials.

## Verify a completed release

The workflow verifies publication before it reports success. An operator can
also check the public state, substituting the released version:

```bash
curl -fsSL https://notary.exalto.ai/downloads/releases/latest
curl -fsSL https://notary.exalto.ai/downloads/releases/channels/latest.json \
  | jq -e '.schema_version == "notary/release-channel-envelope/v1"'
gh release view vX.Y.Z --repo exalto-ai/notary-runtime
```

Confirm that:

- The workflow completed successfully and its summary shows the intended
  private SHA, public SHA, version, and build ID.
- `runtime/vX.Y.Z` and public `vX.Y.Z` identify those exact source commits.
- The plain-text pointer contains the workflow's build ID and version.
- The website Download button resolves to
  `releases/builds/<build-id>/Notary-macos-arm64.dmg` and the download succeeds.
- An installed binary reports the expected version and build ID with
  `notaryctl --version` or `notaryd --version`.

## Failure and recovery

If a job after the version commit fails, promptly use **Re-run failed jobs** on
the same workflow run. A retry accepts an existing tag only when it still
points to the exact commit chosen by that run. Immutable build objects are safe
to upload again.

The CLI build artifacts are retained for one day; desktop and manifest
artifacts are retained for three days. Publication needs the complete set, so
the one-day CLI retention is the effective retry window. After those artifacts
expire, the run cannot be completed and its version cannot be dispatched
again: the version commit has already advanced `main`, and releases must be
strictly increasing. Fix the cause and release the next patch version from the
current green `main` instead.

If `main` advanced before source tagging, do not force the old run through. The
workflow rejects it by design; choose the next stable version and release from
the new green `main` head.

The workflow moves public pointers only after verifying the complete immutable
build, so a failure during build, signing, upload, or verification leaves the
previous release selected. Investigate a pointer-stage failure before retrying,
because one of the two non-atomic pointers may already have moved.

To rotate the updater key, first publish a bridge release whose channel,
manifest, and updater bundle are signed by the old key but whose new binaries
embed the new public key. Keep that bridge release selected long enough for
clients to install it before signing a later channel with the new key. A client
that skips the bridge release cannot authenticate the new key and requires a
manual reinstall.

## Manifest v1 transition

The published 0.1.0 client understands only release-manifest v1. The first v2
release binds the public source SHA and requires a one-time manual upgrade:

- macOS and Linux CLI users reinstall with
  `curl -fsSL https://notary.exalto.ai/install.sh | sh`.
- Windows users replace their binaries from the new ZIP.
- Desktop users install the new signed DMG.

A dual-manifest transition and multiple release channels are intentionally out
of scope.
