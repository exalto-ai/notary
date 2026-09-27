#!/bin/sh
# Vercel Ignored Build Step: exit 0 skips the deployment, exit 1 builds it.
# Vercel runs this from the project Root Directory (platform/web).
#
# The Vercel build (`npm run build:site`: tsc + vite build) reads nothing
# outside this directory. The generated OpenAPI client is committed under
# src/platform-api/generated and CI checks it for drift, so an API contract
# change always lands here too. Any change under this directory builds;
# changes elsewhere skip.
#
# Base: the last successful deployment of this branch (VERCEL_GIT_PREVIOUS_SHA).
# A branch's first deployment has none, so a preview falls back to its
# merge-base with main, fetched on demand into Vercel's shallow clone.
# Every failure to establish a base builds.
set -u

build() { echo "$1; building."; exit 1; }

# Bound each fetch where coreutils timeout exists (Vercel's Linux image).
fetch() {
  if command -v timeout >/dev/null 2>&1; then
    GIT_TERMINAL_PROMPT=0 timeout 60 git fetch --quiet --no-tags "$@"
  else
    GIT_TERMINAL_PROMPT=0 git fetch --quiet --no-tags "$@"
  fi
}

base="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [ -n "$base" ] && git cat-file -e "$base^{commit}" 2>/dev/null; then
  :
elif [ "${VERCEL_ENV:-}" = production ] || [ "${VERCEL_GIT_COMMIT_REF:-}" = main ]; then
  build "No usable previous production deployment"
else
  # Fetch main, then deepen main and HEAD together until they share history
  # (at most ~1000 commits). The clone's remote may lack credentials for a
  # private repository; any fetch failure builds.
  head=$(git rev-parse HEAD) || build "Cannot resolve HEAD"
  main=refs/vercel-ignore/main
  fetch --depth=50 origin "+refs/heads/main:$main" || build "Cannot fetch main"
  tip=$(git rev-parse "$main") || build "Cannot resolve fetched main"
  for _ in 1 2 3 4; do
    git merge-base HEAD "$main" >/dev/null 2>&1 && break
    # Want both commits by SHA: git skips an up-to-date ref, so a refspec
    # would deepen HEAD alone.
    fetch --deepen=250 origin "$tip" "$head" || build "Cannot deepen history"
  done
  base=$(git merge-base HEAD "$main" 2>/dev/null) || build "No merge-base with main"
fi

if git diff --quiet "$base" HEAD -- .; then
  echo "No Capture site changes since $base; skipping."
  exit 0
fi
build "Capture site changed since $base"
