import { docAliases, docNavigation, isDocPageKey } from '../content/docs';

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

// The docs are titled by the navigation label of the page the address
// resolves to, aliases included, so the tab reads as the rail does.
const docTitles = new Map<string, string>(docNavigation.flatMap((group) => group.pages));

export function documentTitle(section: string | undefined, page: string | undefined): string {
  if (!section) return landingTitle;
  if (section === 'docs') {
    const key = page ?? 'overview';
    const doc = docTitles.get(isDocPageKey(key) ? key : (docAliases[key] ?? ''));
    return doc ? `${doc} · Docs · Exalto Capture` : 'Docs · Exalto Capture';
  }
  const name =
    section === 'app' ? (accountTitles[page ?? ''] ?? 'Overview') : sectionTitles[section ?? ''];
  return name ? `${name} · Exalto Capture` : 'Exalto Capture';
}
