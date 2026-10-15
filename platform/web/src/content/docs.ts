// Documentation navigation. The pages themselves are MDX under ./docs, each
// exporting its title and lead; this module is the order they appear in, the
// group each belongs to, and the aliases old links still resolve through.

export type DocPageKey =
  | 'overview'
  | 'getting-started'
  | 'agents'
  | 'how-it-works'
  | 'hosted-credits'
  | 'trace-packages'
  | 'share';

export type DocNavigationGroup = { label: string; pages: Array<readonly [DocPageKey, string]> };

export const legalNotice =
  'Exalto Seal is not a notary public. Sealing is not a notarial act. A receipt is cryptographic evidence, not a legal instrument. The ECP specification uses "notary" as a technical role term, in the way public-key infrastructure uses "certificate authority."';

export const docNavigation: DocNavigationGroup[] = [
  {
    label: 'Start',
    pages: [
      ['overview', 'Overview'],
      ['getting-started', 'Install options'],
      ['agents', 'For agents'],
    ],
  },
  {
    label: 'Understand',
    pages: [
      ['how-it-works', 'Trust model'],
      ['hosted-credits', 'What it costs'],
      ['trace-packages', 'Trace packages'],
    ],
  },
  { label: 'Share', pages: [['share', 'Share a Trace']] },
];

/** Every page key, in reading order. */
export const docOrder: DocPageKey[] = docNavigation.flatMap((group) =>
  group.pages.map(([key]) => key),
);

export const docAliases: Record<string, DocPageKey> = {
  install: 'getting-started',
  proxy: 'getting-started',
  captures: 'getting-started',
  providers: 'getting-started',
  credits: 'hosted-credits',
  plans: 'hosted-credits',
  pricing: 'hosted-credits',
  harnesses: 'getting-started',
  artifacts: 'trace-packages',
  verify: 'trace-packages',
  publish: 'share',
  agent: 'agents',
  llms: 'agents',
};

export function isDocPageKey(value: string): value is DocPageKey {
  return docOrder.includes(value as DocPageKey);
}
