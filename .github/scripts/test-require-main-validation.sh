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

if FAKE_RELATION=diverged run_validator >/dev/null 2>&1; then
  echo "validator accepted a commit outside main" >&2
  exit 1
fi
if FAKE_RUN_RESULT=missing run_validator >/dev/null 2>&1; then
  echo "validator accepted a missing workflow run" >&2
  exit 1
fi
if FAKE_JOB_RESULT=failure run_validator >/dev/null 2>&1; then
  echo "validator accepted a failed Main validation job" >&2
  exit 1
fi

echo "Main validation gate tests passed."
