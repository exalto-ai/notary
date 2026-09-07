import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// The caller has already validated the signed manifest and published artifacts.
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
  writeFileSync(outputFile, createReleaseNotes(
    JSON.parse(readFileSync(manifestFile, 'utf8')), process.env.RELEASE_NOTES,
  ));
}
