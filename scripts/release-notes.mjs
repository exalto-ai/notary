import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { compareVersions } from './runtime-version.mjs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export function previousReleaseTag(releases, version) {
  const versions = releases
    .filter((release) => !release.draft && !release.prerelease && release.published_at)
    .map((release) => release.tag_name)
    .filter((tag) => /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag))
    .map((tag) => tag.slice(1))
    .filter((candidate) => compareVersions(candidate, version) < 0)
    .sort(compareVersions);
  return versions.length ? `runtime/v${versions.at(-1)}` : null;
}

function publicSubject(subject) {
  if (/^Release Runtime v\d+\.\d+\.\d+(?:\s|$)/i.test(subject)) return '';
  // Publish subjects only, without private PR references, URLs, or commit IDs.
  return subject
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/(?:[\w.-]+\/[\w.-]+)?#\d+\b/g, '')
    .replace(/\b[0-9a-f]{40}\b/gi, '')
    .replace(/\(\s*\)|\[\s*\]/g, '')
    .replace(/\s+/g, ' ').trim()
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/([\\`*_[\]])/g, '\\$1');
}

export function generateChanges({ repository = '.', sourceSha, previousTag }) {
  if (!/^[0-9a-f]{40}$/.test(sourceSha)) throw new Error('Expected the exact release source SHA');
  const git = (args) => execFileSync('git', args, { cwd: repository, encoding: 'utf8' }).trim();
  if (previousTag) {
    if (!/^runtime\/v\d+\.\d+\.\d+$/.test(previousTag)) throw new Error('Invalid previous release tag');
    // A missing or unrelated baseline is an error, not an excuse to omit changes.
    git(['merge-base', '--is-ancestor', previousTag, sourceSha]);
  }
  const range = previousTag ? `${previousTag}..${sourceSha}` : sourceSha;
  const subjects = git([
    'log', '--first-parent', '--reverse', '--format=%s', range,
    '--', 'runtime/', 'apps/notary-app/',
  ]).split('\n');
  const changes = [...new Set(subjects.map(publicSubject).filter(Boolean))];
  return `## Changes\n\n${changes.length
    ? changes.map((subject) => `- ${subject}`).join('\n')
    : 'No runtime or desktop changes since the previous published release.'}`;
}

// The caller validates the manifest and publishes its artifacts before posting these notes.
export function createReleaseNotes(manifest, notes) {
  if (!notes?.trim()) throw new Error('Public release notes must describe the changes');
  const source = `https://github.com/exalto-ai/notary-runtime/tree/${manifest.public_source_sha}`;
  const downloads = [
    ['Exalto Capture · macOS Apple silicon', manifest.desktop['darwin-aarch64'].dmg],
    ...Object.entries(manifest.artifacts).map(([platform, artifacts]) => [
      `CLI and daemon · ${platform}`, artifacts.archive,
    ]),
  ];
  const build = new URL('.', downloads[0][1].url).href;
  return `# Notary Runtime ${manifest.version}

${notes.trim()}

## Downloads

${downloads.map(([label, artifact]) => `- [${label}](${artifact.url}) · [SHA-256](${artifact.url}.sha256)`).join('\n')}

## Source and verification

- [Public source](${source}) · tag \`v${manifest.version}\`
- [Signed release manifest](${build}release.json) · [signature](${build}release.json.sig)
- [Verification instructions](${source}/runtime/docs/releases.md)

Checksums detect corruption. Authenticate the manifest signature before trusting
its artifact hashes. The manifest records the public source revision; it is not
a claim of reproducible builds. Official clients authenticate subsequent
updates through the signed \`latest\` channel.

Build ID: \`${manifest.build_id}\`
`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [manifestFile, outputFile] = process.argv.slice(2);
  if (!manifestFile || !outputFile) throw new Error('usage: release-notes.mjs MANIFEST OUTPUT');
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
  let notes = process.env.RELEASE_NOTES?.trim();
  if (!notes) {
    const releases = JSON.parse(execFileSync('gh', [
      'api', '--paginate', '--slurp', 'repos/exalto-ai/notary-runtime/releases',
    ], { encoding: 'utf8' })).flat();
    notes = generateChanges({
      sourceSha: manifest.commit_sha,
      previousTag: previousReleaseTag(releases, manifest.version),
    });
  }
  writeFileSync(outputFile, createReleaseNotes(manifest, notes));
}
