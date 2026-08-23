import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const stableVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const runtimePackages = ['notary-core', 'notary-server', 'notary-updater', 'notaryctl', 'notaryd'];

function parseVersion(value) {
  const match = stableVersion.exec(value);
  if (!match) throw new Error('version must be a stable SemVer value in X.Y.Z form');
  return match.slice(1).map(Number);
}

export function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return a[index] < b[index] ? -1 : 1;
  }
  return 0;
}

async function read(root, relative) {
  return (await readFile(path.join(root, relative), 'utf8')).replaceAll('\r\n', '\n');
}

async function write(root, relative, value) {
  const file = path.join(root, relative);
  const current = await readFile(file, 'utf8');
  const crlf = current.includes('\r\n');
  const bareLf = current.replaceAll('\r\n', '').includes('\n');
  if (crlf && bareLf) throw new Error(`${relative} uses mixed line endings`);
  const serialized = crlf ? value.replaceAll('\n', '\r\n') : value;
  await writeFile(file, serialized);
}

function replaceExactlyOnce(value, pattern, replacement, name) {
  const matches = value.match(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`));
  if (matches?.length !== 1) throw new Error(`${name} did not contain exactly one expected version field`);
  return value.replace(pattern, replacement);
}

function workspaceVersion(cargo) {
  const section = cargo.match(/\[workspace\.package\]\s*\nversion = "([^"]+)"/);
  if (!section) throw new Error('runtime/Cargo.toml has no canonical workspace version');
  parseVersion(section[1]);
  return section[1];
}

function updateLock(lock, packageNames, version, name) {
  let updated = lock;
  for (const packageName of packageNames) {
    const pattern = new RegExp(`(\\[\\[package\\]\\]\\nname = "${packageName}"\\nversion = ")[^"]+("(?:\\n|$))`);
    updated = replaceExactlyOnce(updated, pattern, `$1${version}$2`, `${name}:${packageName}`);
  }
  return updated;
}

function lockVersion(lock, packageName, name) {
  const match = lock.match(new RegExp(`\\[\\[package\\]\\]\\nname = "${packageName}"\\nversion = "([^"]+)"`));
  if (!match) throw new Error(`${name} does not contain ${packageName}`);
  return match[1];
}

export async function currentRuntimeVersion(root) {
  return workspaceVersion(await read(root, 'runtime/Cargo.toml'));
}

export async function setRuntimeVersion(root, version) {
  parseVersion(version);
  const current = await currentRuntimeVersion(root);
  if (compareVersions(version, current) <= 0) {
    throw new Error(`release version ${version} must be greater than the current version ${current}`);
  }

  const runtimeCargo = replaceExactlyOnce(
    await read(root, 'runtime/Cargo.toml'),
    /(\[workspace\.package\]\s*\nversion = ")[^"]+("\s*\n)/,
    `$1${version}$2`,
    'runtime/Cargo.toml',
  );
  await write(root, 'runtime/Cargo.toml', runtimeCargo);

  const appPackage = JSON.parse(await read(root, 'apps/notary-app/package.json'));
  appPackage.version = version;
  await write(root, 'apps/notary-app/package.json', `${JSON.stringify(appPackage, null, 2)}\n`);

  const packageLock = JSON.parse(await read(root, 'apps/notary-app/package-lock.json'));
  packageLock.version = version;
  packageLock.packages[''].version = version;
  await write(root, 'apps/notary-app/package-lock.json', `${JSON.stringify(packageLock, null, 2)}\n`);

  const tauriCargo = replaceExactlyOnce(
    await read(root, 'apps/notary-app/src-tauri/Cargo.toml'),
    /(\[package\]\s*\nname = "notary-app"\s*\nversion = ")[^"]+("\s*\n)/,
    `$1${version}$2`,
    'apps/notary-app/src-tauri/Cargo.toml',
  );
  await write(root, 'apps/notary-app/src-tauri/Cargo.toml', tauriCargo);

  const tauriConfig = JSON.parse(await read(root, 'apps/notary-app/src-tauri/tauri.conf.json'));
  tauriConfig.version = version;
  await write(root, 'apps/notary-app/src-tauri/tauri.conf.json', `${JSON.stringify(tauriConfig, null, 2)}\n`);

  await write(
    root,
    'runtime/Cargo.lock',
    updateLock(await read(root, 'runtime/Cargo.lock'), runtimePackages, version, 'runtime/Cargo.lock'),
  );
  await write(
    root,
    'Cargo.lock',
    updateLock(
      await read(root, 'Cargo.lock'),
      ['notary-app', 'notary-core', 'notary-server', 'notary-updater', 'notaryctl'],
      version,
      'Cargo.lock',
    ),
  );

  await verifyRuntimeVersion(root, version);
}

export async function verifyRuntimeVersion(root, expected) {
  const version = await currentRuntimeVersion(root);
  if (expected !== undefined && version !== expected) {
    throw new Error(`canonical Runtime version is ${version}, expected ${expected}`);
  }

  for (const packageName of runtimePackages) {
    const cargo = await read(root, `runtime/crates/${packageName}/Cargo.toml`);
    if (!/^version\.workspace = true$/m.test(cargo) || /^version = /m.test(cargo)) {
      throw new Error(`runtime package ${packageName} does not inherit the workspace version`);
    }
  }

  const appPackage = JSON.parse(await read(root, 'apps/notary-app/package.json'));
  const packageLock = JSON.parse(await read(root, 'apps/notary-app/package-lock.json'));
  const tauriCargo = await read(root, 'apps/notary-app/src-tauri/Cargo.toml');
  const tauriVersion = tauriCargo.match(/\[package\]\s*\nname = "notary-app"\s*\nversion = "([^"]+)"/);
  const tauriConfig = JSON.parse(await read(root, 'apps/notary-app/src-tauri/tauri.conf.json'));
  const metadata = [
    ['apps/notary-app/package.json', appPackage.version],
    ['apps/notary-app/package-lock.json', packageLock.version],
    ['apps/notary-app/package-lock.json root package', packageLock.packages?.['']?.version],
    ['apps/notary-app/src-tauri/Cargo.toml', tauriVersion?.[1]],
    ['apps/notary-app/src-tauri/tauri.conf.json', tauriConfig.version],
  ];
  for (const [name, value] of metadata) {
    if (value !== version) throw new Error(`${name} version ${value ?? '(missing)'} does not match ${version}`);
  }

  const runtimeLock = await read(root, 'runtime/Cargo.lock');
  for (const packageName of runtimePackages) {
    if (lockVersion(runtimeLock, packageName, 'runtime/Cargo.lock') !== version) {
      throw new Error(`runtime/Cargo.lock version for ${packageName} does not match ${version}`);
    }
  }
  const rootLock = await read(root, 'Cargo.lock');
  for (const packageName of ['notary-app', 'notary-core', 'notary-server', 'notary-updater', 'notaryctl']) {
    if (lockVersion(rootLock, packageName, 'Cargo.lock') !== version) {
      throw new Error(`Cargo.lock version for ${packageName} does not match ${version}`);
    }
  }
  return version;
}

async function main() {
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const [operation, version, extra] = process.argv.slice(2);
  if (extra !== undefined || !['--set', '--check', '--require-next'].includes(operation)) {
    throw new Error('usage: runtime-version.mjs --set X.Y.Z | --check [X.Y.Z] | --require-next X.Y.Z');
  }
  if (operation === '--set') {
    if (!version) throw new Error('--set requires X.Y.Z');
    await setRuntimeVersion(root, version);
    console.log(`Synchronized Runtime release version ${version}`);
  } else if (operation === '--require-next') {
    if (!version) throw new Error('--require-next requires X.Y.Z');
    const current = await currentRuntimeVersion(root);
    parseVersion(version);
    if (compareVersions(version, current) <= 0) {
      throw new Error(`release version ${version} must be greater than the current version ${current}`);
    }
    console.log(`${version} is greater than current Runtime version ${current}`);
  } else {
    const verified = await verifyRuntimeVersion(root, version);
    console.log(`Runtime release metadata agrees on ${verified}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
