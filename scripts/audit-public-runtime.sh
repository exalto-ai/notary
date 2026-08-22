#!/usr/bin/env bash
set -euo pipefail

root="${1:-}"
if test -z "$root" || test ! -d "$root"; then
  echo "usage: $0 PUBLIC_RUNTIME_ROOT" >&2
  exit 1
fi
root="$(cd "$root" && pwd)"

for required in \
  runtime apps/notary-app README.md LICENSE-APACHE LICENSE-MIT \
  rust-toolchain.toml .gitleaks.toml .gitignore .notary-source.json \
  .github/workflows/ci.yml; do
  if test ! -e "$root/$required"; then
    echo "public projection is missing $required" >&2
    exit 1
  fi
done

shopt -s dotglob nullglob
for entry in "$root"/*; do
  name="$(basename "$entry")"
  case "$name" in
    .git|.github|.gitignore|.gitleaks.toml|.notary-source.json|apps|runtime|README.md|LICENSE-APACHE|LICENSE-MIT|rust-toolchain.toml) ;;
    *) echo "public projection contains unapproved root entry: $name" >&2; exit 1 ;;
  esac
done

for forbidden in platform deploy docs compose.yml Dockerfile Cargo.toml Cargo.lock; do
  if test -e "$root/$forbidden"; then
    echo "private root path escaped into public projection: $forbidden" >&2
    exit 1
  fi
done
if find "$root" -type l -print -quit | grep -q .; then
  echo "public projection contains a symbolic link" >&2
  exit 1
fi
if find "$root" -type f \( -name .env -o -name '*.llmcapture' -o -name '*.llmbundle' \
    -o -name '*.sqlite' -o -name '*.key' \) -print -quit | grep -q .; then
  echo "public projection contains a sensitive artifact name" >&2
  exit 1
fi
python3 - "$root" <<'PY'
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
detectors = {
    pathlib.Path("runtime/tooling/check_boundary.py"),
    pathlib.Path("runtime/crates/notary-core/src/public_safety.rs"),
}
markers = (
    ("-----BEGIN PRIVATE KEY-----", "-----END PRIVATE KEY-----"),
    ("-----BEGIN OPENSSH PRIVATE KEY-----", "-----END OPENSSH PRIVATE KEY-----"),
)
for path in root.rglob("*"):
    if not path.is_file() or path.relative_to(root) in detectors or ".git" in path.parts:
        continue
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        continue
    if any(begin in text and end in text for begin, end in markers):
        raise SystemExit(f"public projection contains private key material: {path.relative_to(root)}")
PY
jq -e '
  .schema_version == "notary/source-export/v1" and
  (.canonical_source_sha | test("^[0-9a-f]{40}$"))
' "$root/.notary-source.json" >/dev/null

(cd "$root" && runtime/tooling/check-boundary.sh)
echo "Public Runtime projection audit passed."
