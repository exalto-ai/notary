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

export const landingTitle = 'Exalto Capture · The flight recorder for your AI work';

const docTitles: Record<string, string> = {
  overview: 'Overview',
  'getting-started': 'Install options',
  agents: 'For agents',
  'how-it-works': 'Trust model',
  'hosted-credits': 'What it costs',
  'trace-packages': 'Trace packages',
  share: 'Share a Trace',
};

export function documentTitle(section: string | undefined, page: string | undefined): string {
  if (!section) return landingTitle;
  if (section === 'docs') {
    const doc = docTitles[page ?? 'overview'];
    return doc ? `${doc} · Docs · Exalto Capture` : 'Docs · Exalto Capture';
  }
  const name =
    section === 'app' ? (accountTitles[page ?? ''] ?? 'Overview') : sectionTitles[section ?? ''];
  return name ? `${name} · Exalto Capture` : 'Exalto Capture';
}
