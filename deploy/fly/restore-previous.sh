#!/usr/bin/env bash
set -euo pipefail

# Roll back the dependent notary first, using its actual pre-rollout config.
# Restoring only an image can leave it unable to start with a newer hostname.
rollback_failed=0
server_restored=1
if test -e "$RUNNER_TEMP/notary-server-rollout-attempted"; then
  if ! FLY_API_TOKEN="$NOTARY_SERVER_TOKEN" flyctl deploy \
    --image "$PREVIOUS_NOTARY_SERVER_IMAGE" --ha=false --strategy rolling \
    --skip-release-command --config "$RUNNER_TEMP/previous-notary-server.fly.toml"; then
    rollback_failed=1
    server_restored=0
  fi
fi

if test -e "$RUNNER_TEMP/notary-api-rollout-attempted"; then
  if test "$server_restored" -ne 1; then
    echo "Notary rollback failed; retaining the API it depends on." >&2
  elif ! FLY_API_TOKEN="$NOTARY_API_TOKEN" flyctl deploy \
    --image "$PREVIOUS_NOTARY_API_IMAGE" --ha=true --strategy rolling \
    --skip-release-command --config "$RUNNER_TEMP/previous-notary-api.fly.toml"; then
    rollback_failed=1
  fi
fi

exit "$rollback_failed"
