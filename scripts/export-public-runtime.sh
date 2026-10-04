#!/usr/bin/env bash
set -euo pipefail

source_root="${1:-}"
destination="${2:-}"
source_sha="${3:-}"

if test -z "$source_root" || test -z "$destination"; then
  echo "usage: $0 SOURCE_ROOT EMPTY_DESTINATION [SOURCE_SHA]" >&2
  exit 1
fi
source_root="$(git -C "$source_root" rev-parse --show-toplevel)"
mkdir -p "$destination"
destination="$(cd "$destination" && pwd)"
if find "$destination" -mindepth 1 -print -quit | grep -q .; then
  echo "export destination must be empty: $destination" >&2
  exit 1
fi

if test -z "$source_sha"; then
  source_sha="$(git -C "$source_root" rev-parse HEAD)"
fi
if ! [[ "$source_sha" =~ ^[0-9a-f]{40}$ ]]; then
  echo "source SHA must contain 40 lowercase hexadecimal characters" >&2
  exit 1
fi
resolved="$(git -C "$source_root" rev-parse "$source_sha^{commit}")"
if test "$resolved" != "$source_sha"; then
  echo "source SHA did not resolve exactly" >&2
  exit 1
fi
if test "$(git -C "$source_root" rev-parse HEAD)" != "$source_sha"; then
  echo "source checkout HEAD does not match the recorded source SHA" >&2
  exit 1
fi

paths_file="$source_root/scripts/public-runtime-paths.txt"
paths=()
while IFS= read -r path; do
  paths+=("$path")
done < <(sed -e '/^[[:space:]]*#/d' -e '/^[[:space:]]*$/d' "$paths_file")
if test "${#paths[@]}" -eq 0; then
  echo "public Runtime allowlist is empty" >&2
  exit 1
fi
if ! git -C "$source_root" diff --quiet HEAD -- \
    "${paths[@]}" scripts/public-runtime-paths.txt scripts/public-runtime; then
  echo "source checkout has uncommitted public projection changes" >&2
  exit 1
fi

(
  cd "$source_root"
  git ls-files -z -- "${paths[@]}" | tar --null --files-from=- --create --file=-
) | tar --extract --directory "$destination"

# Here the desktop crate resolves inside the root workspace; in the projection
# it is a standalone package. Give it the root workspace's spansy patch and the
# root Cargo.lock pruned to its own dependency graph, so the public build uses
# exactly the crate versions this repository ships. Pruning keeps locked
# versions; the check below rejects any package the root lock does not pin.
desktop_crate="$destination/apps/notary-app/src-tauri"
if grep -q '^\[patch' "$desktop_crate/Cargo.toml"; then
  echo "desktop manifest already declares a patch section" >&2
  exit 1
fi
cat >> "$desktop_crate/Cargo.toml" <<'TOML'

# Added by the public Runtime export to match the canonical workspace root.
[patch."https://github.com/tlsnotary/tlsn-utils"]
spansy = { path = "../../../runtime/vendor/tlsn-utils/spansy" }
TOML
install -m 0644 "$source_root/Cargo.lock" "$desktop_crate/Cargo.lock"
(cd "$destination" && cargo update --quiet --workspace \
  --manifest-path apps/notary-app/src-tauri/Cargo.toml)
python3 - "$source_root/Cargo.lock" "$desktop_crate/Cargo.lock" <<'PY'
import sys
import tomllib

def pins(path):
    with open(path, "rb") as lock:
        return {
            (p["name"], p["version"], p.get("source"), p.get("checksum"))
            for p in tomllib.load(lock)["package"]
        }

unpinned = pins(sys.argv[2]) - pins(sys.argv[1])
if unpinned:
    raise SystemExit(f"desktop Cargo.lock diverges from the root lock: {sorted(unpinned, key=str)}")
PY

install -m 0644 "$source_root/runtime/LICENSE-MIT" "$destination/LICENSE-MIT"
mkdir -p "$destination/.github/workflows"
install -m 0644 "$source_root/scripts/public-runtime/README.md" "$destination/README.md"
install -m 0644 "$source_root/scripts/public-runtime/SECURITY.md" "$destination/SECURITY.md"
install -m 0644 "$source_root/scripts/public-runtime/gitignore" "$destination/.gitignore"
install -m 0644 "$source_root/scripts/public-runtime/ci.yml" \
  "$destination/.github/workflows/ci.yml"
jq -n \
  --arg schema_version notary/source-export/v1 \
  --arg canonical_source_sha "$source_sha" \
  '{schema_version: $schema_version, canonical_source_sha: $canonical_source_sha}' \
  > "$destination/.notary-source.json"

echo "Exported public Runtime source $source_sha to $destination"
