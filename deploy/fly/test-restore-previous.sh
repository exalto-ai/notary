#!/usr/bin/env bash
set -euo pipefail

script="$(cd "$(dirname "$0")" && pwd)/restore-previous.sh"
test_root="$(mktemp -d)"
trap 'rm -rf "$test_root"' EXIT
mkdir -p "$test_root/bin" "$test_root/state"
export RUNNER_TEMP="$test_root/state"
export CALL_LOG="$test_root/calls"
export NOTARY_SERVER_TOKEN=server-token NOTARY_API_TOKEN=api-token
export PREVIOUS_NOTARY_SERVER_IMAGE=server-image PREVIOUS_NOTARY_API_IMAGE=api-image
cat > "$test_root/bin/flyctl" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$CALL_LOG"
if [[ "$*" == *server-image* && "${FAIL_SERVER:-0}" == 1 ]]; then exit 1; fi
if [[ "$*" == *api-image* && "${FAIL_API:-0}" == 1 ]]; then exit 1; fi
STUB
chmod +x "$test_root/bin/flyctl"
export PATH="$test_root/bin:$PATH"

# An unattempted rollout must not touch either service.
bash "$script"
test ! -e "$CALL_LOG"

touch "$RUNNER_TEMP/notary-api-rollout-attempted"
bash "$script"
test "$(wc -l < "$CALL_LOG" | tr -d ' ')" = 1
grep -q -- "--config $RUNNER_TEMP/previous-notary-api.fly.toml" "$CALL_LOG"

# Restore both images with their saved configurations, not repository configs.
touch "$RUNNER_TEMP/notary-server-rollout-attempted"
: > "$CALL_LOG"
bash "$script"
test "$(wc -l < "$CALL_LOG" | tr -d ' ')" = 2
sed -n '1p' "$CALL_LOG" | grep -q -- "--image server-image.*--skip-release-command --config $RUNNER_TEMP/previous-notary-server.fly.toml"
sed -n '2p' "$CALL_LOG" | grep -q -- "--image api-image.*--skip-release-command --config $RUNNER_TEMP/previous-notary-api.fly.toml"

# Keep the API running if the dependent notary cannot be restored.
: > "$CALL_LOG"
if FAIL_SERVER=1 bash "$script"; then exit 1; fi
test "$(wc -l < "$CALL_LOG" | tr -d ' ')" = 1

# Propagate API restore failures too.
: > "$CALL_LOG"
if FAIL_API=1 bash "$script"; then exit 1; fi
test "$(wc -l < "$CALL_LOG" | tr -d ' ')" = 2
echo "Fly rollback tests passed."
