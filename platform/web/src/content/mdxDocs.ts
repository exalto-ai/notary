import type { MDXContent } from 'mdx/types';
import type { DocPageKey } from './docs';
import Agents, {
  lead as agentsLead,
  docSections as agentsSections,
  title as agentsTitle,
} from './docs/agents.mdx';
import GettingStarted, {
  lead as gettingStartedLead,
  docSections as gettingStartedSections,
  title as gettingStartedTitle,
} from './docs/getting-started.mdx';
import HostedCredits, {
  lead as hostedCreditsLead,
  docSections as hostedCreditsSections,
  title as hostedCreditsTitle,
} from './docs/hosted-credits.mdx';
import HowItWorks, {
  lead as howItWorksLead,
  docSections as howItWorksSections,
  title as howItWorksTitle,
} from './docs/how-it-works.mdx';
import Overview, {
  lead as overviewLead,
  docSections as overviewSections,
  title as overviewTitle,
} from './docs/overview.mdx';
import Share, {
  lead as shareLead,
  docSections as shareSections,
  title as shareTitle,
} from './docs/share.mdx';
import TracePackages, {
  docSections as tracePackageSections,
  lead as tracePackagesLead,
  title as tracePackagesTitle,
} from './docs/trace-packages.mdx';

export type MdxDocSection = {
  heading: string;
  id: string;
  level: 2 | 3;
  text: string;
};

export type MdxDoc = {
  Content: MDXContent;
  title: string;
  lead: string;
  sections: MdxDocSection[];
};

export const mdxDocs: Record<DocPageKey, MdxDoc> = {
  overview: {
    Content: Overview,
    title: overviewTitle,
    lead: overviewLead,
    sections: overviewSections,
  },
  'getting-started': {
    Content: GettingStarted,
    title: gettingStartedTitle,
    lead: gettingStartedLead,
    sections: gettingStartedSections,
  },
  agents: { Content: Agents, title: agentsTitle, lead: agentsLead, sections: agentsSections },
  'how-it-works': {
    Content: HowItWorks,
    title: howItWorksTitle,
    lead: howItWorksLead,
    sections: howItWorksSections,
  },
  'hosted-credits': {
    Content: HostedCredits,
    title: hostedCreditsTitle,
    lead: hostedCreditsLead,
    sections: hostedCreditsSections,
  },
  'trace-packages': {
    Content: TracePackages,
    title: tracePackagesTitle,
    lead: tracePackagesLead,
    sections: tracePackageSections,
  },
  share: { Content: Share, title: shareTitle, lead: shareLead, sections: shareSections },
};
