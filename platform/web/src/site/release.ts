// Fetch published release metadata directly from the public artifact bucket.
const DOWNLOAD_ROOT = 'https://notary-prod-downloads.t3.tigrisfiles.io/releases';
const MACOS_TARGET = 'darwin-aarch64';

export type MacosDownload = {
  url: string;
  version: string;
  sizeBytes: number;
};

// Same rule the command-line installer applies: a pointer that names anything
// other than a plain build identifier is malformed, never a path to follow.
function safeIdentifier(value: string): boolean {
  return /^[A-Za-z0-9._-]+$/.test(value) && !value.startsWith('.') && !value.includes('..');
}

export async function fetchLatestMacosDownload(
  request: typeof fetch = fetch,
): Promise<MacosDownload | null> {
  try {
    const pointerResponse = await request(`${DOWNLOAD_ROOT}/latest`, { cache: 'no-store' });
    if (!pointerResponse.ok) return null;
    const [buildId, version] = (await pointerResponse.text()).trim().split(/\s+/);
    if (!buildId || !version || !safeIdentifier(buildId) || !safeIdentifier(version)) return null;

    const buildUrl = `${DOWNLOAD_ROOT}/builds/${buildId}`;
    const manifestResponse = await request(`${buildUrl}/release.json`, { cache: 'no-store' });
    if (!manifestResponse.ok) return null;
    const manifest = await manifestResponse.json();
    const dmg = manifest?.desktop?.[MACOS_TARGET]?.dmg;
    if (!dmg || typeof dmg.name !== 'string' || !safeIdentifier(dmg.name)) return null;

    return {
      url: `${buildUrl}/${dmg.name}`,
      version: typeof manifest.version === 'string' ? manifest.version : version,
      sizeBytes: Number.isFinite(dmg.size_bytes) ? dmg.size_bytes : 0,
    };
  } catch {
    return null;
  }
}

export function downloadSize(sizeBytes: number): string {
  if (!sizeBytes) return '';
  return `${Math.round(sizeBytes / 1_000_000)} MB`;
}
