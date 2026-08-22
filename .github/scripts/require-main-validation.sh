#!/usr/bin/env bash
set -euo pipefail

sha="${1:-}"
repository="${GITHUB_REPOSITORY:-}"
workflow="${MAIN_VALIDATION_WORKFLOW:-ci.yml}"
gh_bin="${GH_BIN:-gh}"

if ! [[ "$sha" =~ ^[0-9a-f]{40}$ ]]; then
  echo "source SHA must contain 40 lowercase hexadecimal characters" >&2
  exit 1
fi
if ! [[ "$repository" =~ ^[^/]+/[^/]+$ ]]; then
  echo "GITHUB_REPOSITORY must use owner/name form" >&2
  exit 1
fi

resolved="$($gh_bin api "repos/$repository/commits/$sha" --jq .sha)"
if test "$resolved" != "$sha"; then
  echo "GitHub resolved $sha to unexpected commit $resolved" >&2
  exit 1
fi

main_sha="$($gh_bin api "repos/$repository/git/ref/heads/main" --jq .object.sha)"
relation="$($gh_bin api "repos/$repository/compare/$sha...$main_sha" --jq .status)"
case "$relation" in
  ahead|identical) ;;
  *)
    echo "$sha is not reachable from the current main branch (compare status: $relation)" >&2
    exit 1
    ;;
esac

runs="$($gh_bin api --method GET "repos/$repository/actions/workflows/$workflow/runs" \
  -f head_sha="$sha" -f branch=main -f event=push -f status=completed -f per_page=100)"
mapfile -t run_ids < <(jq -r --arg sha "$sha" '
  .workflow_runs[]
  | select(.head_sha == $sha and .head_branch == "main" and .event == "push" and .conclusion == "success")
  | .id
' <<<"$runs")

for run_id in "${run_ids[@]}"; do
  jobs="$($gh_bin api --method GET "repos/$repository/actions/runs/$run_id/jobs" -f per_page=100)"
  if jq -e '.jobs[] | select(.name == "Main validation" and .conclusion == "success")' \
      <<<"$jobs" >/dev/null; then
    echo "validated main SHA $sha with workflow run $run_id"
    exit 0
  fi
done

echo "$sha has no successful exact Main validation result" >&2
exit 1
