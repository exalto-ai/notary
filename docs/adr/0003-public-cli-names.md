# ADR 0003: Public command names

Status: accepted for the public site; Runtime rename pending

## Context

The settled product vocabulary is capture, seal, verify: you capture, Exalto
Seal (or another notary) seals, anyone verifies. The public site, the docs, the
agent prompt and `llms.txt` now use that vocabulary end to end, including the
command names a reader types. The Runtime still ships the binaries and
subcommands it was born with: `notaryctl`, `notaryd`, and `notaryctl traces
notarize`. Every quickstart on capture.exalto.ai therefore names a command
that the installed Runtime does not yet provide.

The October 2026 site refresh (`platform/web`) chose the public names on the
site rather than teaching readers the old ones, and left the Runtime rename as
work to schedule. This record fixes the names, the mapping, and the order in
which the rename lands, so the two stop drifting.

## Decision

The public command names are:

| Today (Runtime) | Public name | Surface |
| --- | --- | --- |
| `notaryctl` | `capture` | CLI binary, installer, updater, skill, docs |
| `notaryd` | `captured` | local service binary, desktop app supervision, installer, docs |
| `notaryctl traces notarize` | `capture traces seal` | clap subcommand; `notarize` stays as a hidden alias |
| `Notarized` (CLI and dashboard state label) | `Sealed` | user-facing output only; API state values are unchanged |
| "notarization" in CLI and dashboard prose | "sealing" | user-facing output only; `/v1/traces/{id}/notarizations` and operation names stay for protocol compatibility |
| skill `notary` (`notaryctl skill install`) | skill `capture` (`capture skill install`) | `runtime/skills/notary/SKILL.md`, its workflows reference, and the installer's directory name |
| `NOTARYD_*` environment variables | `CAPTURED_*`, with the old names still read | daemon configuration |
| `NOTARY_DOWNLOAD_ROOT`, `NOTARY_INSTALL_DIR` | `CAPTURE_DOWNLOAD_ROOT`, `CAPTURE_INSTALL_DIR`, with the old names still read | `platform/web/public/install.sh` |

Not renamed by this decision, because each one is a compatibility surface
with existing installs: the configuration and data directory (`notary/`), the
release archive name (`notary-runtime-<version>-<platform>-<arch>.tar.gz`),
the public repository name (`exalto-ai/notary-runtime`), the crate names, and
every runtime API route, state value and JSON field. Lowercase "notary" also
remains the technical role term in protocol documentation and in the ECP
specification.

Until the Runtime ships the renamed binaries, `install.sh` installs two shims
next to the binaries: `captured` executes `notaryd`, and `capture` executes
`notaryctl`, rewriting `traces seal` to `traces notarize`. The shims resolve
the sibling binary at run time, so the in-place updater keeps working. They
are removed from the installer in the last step below.

## Order of work

1. Runtime: add `seal` as a visible alias of `traces notarize` and emit the
   public verbs in human-readable output. Add `capture` and `captured` as
   binary names in `runtime/crates/notaryctl` and `runtime/crates/notaryd`
   (`[[bin]]`), and ship `notaryctl` and `notaryd` as compatibility symlinks
   in the release archive for two release cycles.
2. Desktop app: supervise `captured`, with `notaryd` as the fallback name.
3. Skill and docs: rename the skill to `capture`, rewrite its commands and
   the Runtime docs, and regenerate `llms.txt`'s Runtime references.
4. Installer: install the renamed binaries directly and delete the shims.
5. Terminology: once nothing user-facing says `notaryctl` or `notaryd`, add
   them to `scripts/check-terminology.mjs` as retired executable names, with
   the compatibility symlinks classified.

## Consequences

- The site, the docs, the agent prompt and the skill speak one vocabulary,
  and a reader never has to learn that "seal" is "notarize" underneath.
- Until step 1 lands, the shims carry the public names. A reader who installs
  from source gets the Runtime's own names and the docs tell them so.
- The rename touches the updater's install directory and the desktop app's
  process supervision; both need release notes.

Commands that would make the documented agent procedure one step each are
tracked in [#540](https://github.com/exalto-ai/notary/issues/540), not
decided here.
