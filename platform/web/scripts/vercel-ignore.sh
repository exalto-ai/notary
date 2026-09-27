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
# Build whenever the comparison base is unknown: a branch's first deployment
# has no VERCEL_GIT_PREVIOUS_SHA, and Vercel's shallow clone may not contain it.
set -u

base="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [ -z "$base" ]; then
  echo "No previous deployment for this branch; building."
  exit 1
fi
if ! git cat-file -e "$base^{commit}" 2>/dev/null; then
  echo "Previous deployment $base is not in the clone; building."
  exit 1
fi
if git diff --quiet "$base" HEAD -- .; then
  echo "No Capture site changes since $base; skipping."
  exit 0
fi
echo "Capture site changed since $base; building."
exit 1
