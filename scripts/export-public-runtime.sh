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
mapfile -t paths < <(sed -e '/^[[:space:]]*#/d' -e '/^[[:space:]]*$/d' "$paths_file")
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

mkdir -p "$destination/.github/workflows"
install -m 0644 "$source_root/scripts/public-runtime/README.md" "$destination/README.md"
install -m 0644 "$source_root/scripts/public-runtime/gitignore" "$destination/.gitignore"
install -m 0644 "$source_root/scripts/public-runtime/ci.yml" \
  "$destination/.github/workflows/ci.yml"
jq -n \
  --arg schema_version notary/source-export/v1 \
  --arg canonical_source_sha "$source_sha" \
  '{schema_version: $schema_version, canonical_source_sha: $canonical_source_sha}' \
  > "$destination/.notary-source.json"

echo "Exported public Runtime source $source_sha to $destination"
