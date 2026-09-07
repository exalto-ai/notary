import assert from 'node:assert/strict';
import test from 'node:test';
import { createReleaseNotes } from './release-notes.mjs';

const build = 'https://seal.exalto.ai/downloads/releases/builds/runtime-v1.2.3-test/';
const manifest = {
  version: '1.2.3', build_id: 'runtime-v1.2.3-test',
  commit_sha: 'a'.repeat(40), public_source_sha: 'b'.repeat(40),
  desktop: { 'darwin-aarch64': { dmg: { url: `${build}Exalto-Capture-macos-arm64.dmg` } } },
  artifacts: Object.fromEntries(['linux-x86_64', 'linux-aarch64', 'darwin-aarch64', 'windows-x86_64']
    .map((platform) => [platform, { archive: { url: `${build}${platform}.archive` } }])),
};

test('release notes use immutable manifest downloads and publicly accessible source', () => {
  const changes = '## Changes\n\n- Fix capture recovery.\n\n## Compatibility\n\nManual upgrade required.\n\nLiteral `$(example)`.';
  const result = createReleaseNotes(manifest, changes);
  assert.ok(result.includes(changes));
  for (const { archive } of Object.values(manifest.artifacts)) {
    assert.ok(result.includes(`](${archive.url})`));
    assert.ok(result.includes(`](${archive.url}.sha256)`));
  }
  assert.ok(result.includes(`](${build}release.json.sig)`));
  assert.ok(result.includes(`/tree/${manifest.public_source_sha}/runtime/docs/releases.md`));
  assert.ok(!result.includes(manifest.commit_sha));
  assert.ok(!result.includes('github.com/exalto-ai/notary/'));
});

test('release notes reject empty public change descriptions', () => {
  for (const notes of [undefined, '', ' \n\t']) {
    assert.throws(() => createReleaseNotes(manifest, notes), /must describe the changes/);
  }
});
