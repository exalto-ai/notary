#!/usr/bin/env bash
set -euo pipefail

projection="${1:-}"
public_checkout="${2:-}"
source_sha="${3:-}"
if test ! -d "$projection" || ! git -C "$public_checkout" rev-parse --git-dir >/dev/null 2>&1; then
  echo "usage: $0 PROJECTION PUBLIC_GIT_CHECKOUT SOURCE_SHA" >&2
  exit 1
fi
if ! [[ "$source_sha" =~ ^[0-9a-f]{40}$ ]]; then
  echo "source SHA must contain 40 lowercase hexadecimal characters" >&2
  exit 1
fi

changes="$(rsync --archive --checksum --no-times --omit-dir-times \
  --dry-run --itemize-changes --delete --exclude=.git --exclude=.notary-source.json \
  "$projection/" "$public_checkout/")"
if test -z "$changes"; then
  echo "Public Runtime projection is unchanged; export is a no-op."
  exit 0
fi

rsync --archive --delete --exclude=.git "$projection/" "$public_checkout/"
git -C "$public_checkout" add --all --force -- .
if git -C "$public_checkout" diff --cached --quiet; then
  echo "Public Runtime projection is unchanged; export is a no-op."
  exit 0
fi
git -C "$public_checkout" commit -m "Export Runtime from $source_sha"
configured_name="$(git -C "$public_checkout" config user.name)"
configured_email="$(git -C "$public_checkout" config user.email)"
expected_identity="$(printf '%s <%s>\n%s <%s>' \
  "$configured_name" "$configured_email" "$configured_name" "$configured_email")"
actual_identity="$(git -C "$public_checkout" show \
  --no-patch --format='%an <%ae>%n%cn <%ce>' HEAD)"
if test "$actual_identity" != "$expected_identity"; then
  echo "public Runtime export author or committer identity is incorrect" >&2
  exit 1
fi
git -C "$public_checkout" push origin HEAD:main
