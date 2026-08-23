#!/usr/bin/env bash
set -euo pipefail

repository="$(git rev-parse --show-toplevel)"
source_sha="$(git rev-parse HEAD)"
first="$(mktemp -d)"
second="$(mktemp -d)"
bare="$(mktemp -d)"
checkout="$(mktemp -d)"
trap 'rm -rf "$first" "$second" "$bare" "$checkout"' EXIT

scripts/export-public-runtime.sh "$repository" "$first" "$source_sha" >/dev/null
git -C "$first" init --quiet
git -C "$first" add --all --force -- .
scripts/audit-public-runtime.sh "$first" >/dev/null

test ! -e "$first/platform"
test ! -e "$first/deploy"
test "$(jq -r .canonical_source_sha "$first/.notary-source.json")" = "$source_sha"

scripts/export-public-runtime.sh "$repository" "$second" "$source_sha" >/dev/null
diff --recursive --brief "$first" "$second" --exclude=.git >/dev/null

git init --bare --quiet --initial-branch=main "$bare"
git clone --quiet "$bare" "$checkout"
git -C "$checkout" config user.name "Notary Runtime Export Test"
git -C "$checkout" config user.email "runtime-export-test@example.com"
scripts/publish-public-runtime.sh "$first" "$checkout" "$source_sha" >/dev/null
diff \
  <(find "$first" -path "$first/.git" -prune -o \( -type f -o -type l \) -printf '%P\n' | sort) \
  <(git -C "$checkout" ls-files | sort)

chmod -x "$checkout/runtime/tooling/check-boundary.sh"
git -C "$checkout" add -- runtime/tooling/check-boundary.sh
git -C "$checkout" commit --quiet -m "Simulate lost executable mode"
git -C "$checkout" push --quiet origin HEAD:main
scripts/publish-public-runtime.sh "$first" "$checkout" "$source_sha" >/dev/null
test "$(git --git-dir="$bare" ls-tree main runtime/tooling/check-boundary.sh | cut -d' ' -f1)" = 100755

second_sha=2222222222222222222222222222222222222222
jq --arg sha "$second_sha" '.canonical_source_sha = $sha' \
  "$second/.notary-source.json" > "$second/.notary-source.json.next"
mv "$second/.notary-source.json.next" "$second/.notary-source.json"
scripts/publish-public-runtime.sh "$second" "$checkout" "$second_sha" >/dev/null
test "$(git --git-dir="$bare" rev-list --count main)" -eq 3
test "$(git --git-dir="$bare" show main:.notary-source.json | jq -r .canonical_source_sha)" = "$source_sha"
echo "Public Runtime export tests passed."
