// The same titles the shipped site sets, so a tab reads the same either side
// of the cutover.
const sectionTitles: Record<string, string> = {
  authorize: 'Connect device',
  docs: 'Docs',
  privacy: 'Privacy',
  signin: 'Sign in',
  terms: 'Terms',
};

const accountTitles: Record<string, string> = {
  overview: 'Overview',
  traces: 'Traces',
  usage: 'Usage',
  settings: 'Settings',
};

export function documentTitle(section: string | undefined, page: string | undefined): string {
  const name =
    section === 'app' ? (accountTitles[page ?? ''] ?? 'Overview') : sectionTitles[section ?? ''];
  return name ? `${name} · Exalto Capture` : 'Exalto Capture';
}
