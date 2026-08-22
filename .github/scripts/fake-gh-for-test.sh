#!/usr/bin/env bash
set -euo pipefail

arguments="$*"
case "$arguments" in
  *"/commits/"*)
    printf '%s\n' "${FAKE_SHA:?}"
    ;;
  *"/git/ref/heads/main"*)
    printf '%s\n' "${FAKE_MAIN_SHA:-${FAKE_SHA:?}}"
    ;;
  *"/compare/"*)
    printf '%s\n' "${FAKE_RELATION:-ahead}"
    ;;
  *"/actions/workflows/ci.yml/runs"*)
    if test "${FAKE_RUN_RESULT:-success}" = success; then
      printf '{"workflow_runs":[{"id":42,"head_sha":"%s","head_branch":"main","event":"push","conclusion":"success"}]}\n' "$FAKE_SHA"
    else
      printf '{"workflow_runs":[]}\n'
    fi
    ;;
  *"/actions/runs/42/jobs"*)
    printf '{"jobs":[{"name":"Main validation","conclusion":"%s"}]}\n' "${FAKE_JOB_RESULT:-success}"
    ;;
  *)
    echo "unexpected fake gh invocation: $arguments" >&2
    exit 1
    ;;
esac
