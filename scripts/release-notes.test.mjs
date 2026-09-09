import assert from 'node:assert/strict';
import test from 'node:test';
import { createReleaseNotes, generateChanges, previousReleaseTag } from './release-notes.mjs';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const build = 'https://notary-prod-downloads.t3.tigrisfiles.io/releases/builds/runtime-v1.2.3-test/';
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

function repositoryFixture(t) {
  const repository = mkdtempSync(path.join(tmpdir(), 'notary-notes-'));
  t.after(() => rmSync(repository, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: repository, encoding: 'utf8' }).trim();
  git('init', '--quiet', '--initial-branch=main');
  git('config', 'user.name', 'Release test');
  git('config', 'user.email', 'release-test@example.com');
  git('config', 'commit.gpgsign', 'false');
  let revision = 0;
  const commit = (file, subject, body = '') => {
    mkdirSync(path.dirname(path.join(repository, file)), { recursive: true });
    writeFileSync(path.join(repository, file), `${revision++}\n`);
    git('add', '--', file);
    git('commit', '--quiet', '-m', subject, '-m', body);
    return git('rev-parse', 'HEAD');
  };
  return { repository, git, commit };
}

test('automatic notes select only released stable baselines, numerically and before this version', () => {
  const release = (tag_name, extra = {}) => ({ tag_name, published_at: '2026-09-01', ...extra });
  const releases = [
    release('v1.2.9'), release('v1.2.10'), release('v1.2.11', { draft: true }),
    release('v1.2.12', { prerelease: true }), release('v1.2.13', { published_at: null }),
    release('v1.2.14-rc.1'), release('v1.2.15'), release('v2.0.0'),
  ];
  assert.equal(previousReleaseTag(releases, '1.2.15'), 'runtime/v1.2.10');
  assert.equal(previousReleaseTag(releases, '1.0.0'), null);
  assert.equal(previousReleaseTag([], '1.0.0'), null);
});

test('automatic notes filter private changes and references within the exact release range', (t) => {
  const { repository, git, commit } = repositoryFixture(t);
  commit('runtime/source.rs', 'Earlier runtime work');
  git('tag', 'runtime/v1.2.1');
  commit('platform/billing.rs', 'Private billing policy');
  commit('runtime/source.rs', 'Fix capture recovery (#123)', 'Private discussion must not be copied.');
  git('tag', 'runtime/v1.2.2'); // A failed release tag must not truncate the selected range.
  commit('apps/notary-app/app.ts', 'Improve startup [details](https://github.com/exalto-ai/notary/pull/456)');
  commit('runtime/source.rs', 'Fix capture recovery (#789)');
  const sourceSha = commit('runtime/Cargo.toml', 'Release Runtime v1.2.3 (#364)');
  commit('runtime/source.rs', 'Future change');
  const result = generateChanges({ repository, sourceSha, previousTag: 'runtime/v1.2.1' });
  assert.equal(result, '## Changes\n\n- Fix capture recovery\n- Improve startup details');
});

test('first release, empty range, and merge commits produce predictable notes', (t) => {
  const { repository, git, commit } = repositoryFixture(t);
  const initialSha = commit('runtime/source.rs', 'Initial runtime');
  assert.equal(generateChanges({ repository, sourceSha: initialSha, previousTag: null }),
    '## Changes\n\n- Initial runtime');
  git('tag', 'runtime/v1.0.0');
  git('checkout', '--quiet', '-b', 'feature');
  commit('runtime/source.rs', 'Internal implementation detail');
  git('checkout', '--quiet', 'main');
  git('merge', '--quiet', '--no-ff', 'feature', '-m', 'Improve recovery (#12)');
  const sourceSha = git('rev-parse', 'HEAD');
  assert.equal(generateChanges({ repository, sourceSha, previousTag: 'runtime/v1.0.0' }),
    '## Changes\n\n- Improve recovery');
  git('tag', 'runtime/v1.1.0');
  assert.match(generateChanges({ repository, sourceSha, previousTag: 'runtime/v1.1.0' }),
    /No runtime or desktop changes/);
});

test('an explicit override works without Git history or GitHub API access', (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'notary-notes-override-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const manifestFile = path.join(directory, 'release.json');
  const outputFile = path.join(directory, 'notes.md');
  writeFileSync(manifestFile, JSON.stringify(manifest));
  const notes = '## Upgrade\n\nInstall manually. Literal `$(example)`.';
  execFileSync(process.execPath, [fileURLToPath(new URL('./release-notes.mjs', import.meta.url)),
    manifestFile, outputFile], { cwd: directory, env: { ...process.env, RELEASE_NOTES: notes, PATH: '' } });
  assert.ok(readFileSync(outputFile, 'utf8').includes(notes));
});
