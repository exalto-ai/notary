#!/usr/bin/env bash
set -euo pipefail

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
validator="$script_dir/require-main-validation.sh"
fake_gh="$script_dir/fake-gh-for-test.sh"
sha=1111111111111111111111111111111111111111

run_validator() {
  GITHUB_REPOSITORY=exalto-ai/notary \
    GH_BIN="$fake_gh" \
    FAKE_SHA="$sha" \
    "$validator" "$sha"
}

run_validator >/dev/null
FAKE_RELATION=identical run_validator >/dev/null
FAKE_MAIN_SHA=2222222222222222222222222222222222222222 \
  FAKE_RELATION=ahead run_validator >/dev/null

for relation in diverged behind; do
  if FAKE_RELATION="$relation" run_validator >/dev/null 2>&1; then
    echo "validator accepted a commit outside main: $relation" >&2
    exit 1
  fi
done
if FAKE_RUN_RESULT=missing run_validator >/dev/null 2>&1; then
  echo "validator accepted a missing workflow run" >&2
  exit 1
fi
if FAKE_JOB_RESULT=failure run_validator >/dev/null 2>&1; then
  echo "validator accepted a failed Main validation job" >&2
  exit 1
fi

echo "Main validation gate tests passed."
