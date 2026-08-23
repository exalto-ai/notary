import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  compareVersions,
  currentRuntimeVersion,
  setRuntimeVersion,
  verifyRuntimeVersion,
} from './runtime-version.mjs';

const repository = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'notary-runtime-version-'));
  const files = [
    'Cargo.lock',
    'runtime/Cargo.toml',
    'runtime/Cargo.lock',
    ...['notary-core', 'notary-server', 'notary-updater', 'notaryctl', 'notaryd']
      .map((name) => `runtime/crates/${name}/Cargo.toml`),
    'apps/notary-app/package.json',
    'apps/notary-app/package-lock.json',
    'apps/notary-app/src-tauri/Cargo.toml',
    'apps/notary-app/src-tauri/tauri.conf.json',
  ];
  for (const relative of files) {
    await mkdir(path.dirname(path.join(root, relative)), { recursive: true });
    await cp(path.join(repository, relative), path.join(root, relative), {
      recursive: false,
    });
  }
  return root;
}

test('stable SemVer comparison is numeric and rejects non-stable values', () => {
  assert.equal(compareVersions('1.10.0', '1.9.9'), 1);
  assert.equal(compareVersions('2.0.0', '2.0.0'), 0);
  assert.throws(() => compareVersions('01.0.0', '1.0.0'), /stable SemVer/);
  assert.throws(() => compareVersions('1.0.0-rc.1', '1.0.0'), /stable SemVer/);
});

test('one operation synchronizes Runtime, desktop, and lockfile versions', async () => {
  const root = await fixture();
  const current = await currentRuntimeVersion(root);
  const [major, minor, patch] = current.split('.').map(Number);
  const next = `${major}.${minor}.${patch + 1}`;
  await setRuntimeVersion(root, next);
  assert.equal(await currentRuntimeVersion(root), next);
  assert.equal(await verifyRuntimeVersion(root, next), next);
  assert.ok((await readFile(path.join(root, 'runtime/Cargo.lock'), 'utf8'))
    .includes(`name = "notaryd"\nversion = "${next}"`));
  await assert.rejects(() => setRuntimeVersion(root, next), /must be greater/);
});

test('verification rejects drifting desktop metadata', async () => {
  const root = await fixture();
  const packageFile = path.join(root, 'apps/notary-app/package.json');
  const appPackage = JSON.parse(await readFile(packageFile, 'utf8'));
  appPackage.version = '9.9.9';
  await writeFile(packageFile, `${JSON.stringify(appPackage, null, 2)}\n`);
  await assert.rejects(() => verifyRuntimeVersion(root), /does not match/);
});
