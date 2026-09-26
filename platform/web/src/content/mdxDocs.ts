import type { MDXContent } from 'mdx/types';
import type { DocPageKey } from './docs';
import GettingStarted, {
  lead as gettingStartedLead,
  docSections as gettingStartedSections,
  title as gettingStartedTitle,
} from './docs/getting-started.mdx';
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

export const mdxDocs: Partial<Record<DocPageKey, MdxDoc>> = {
  'getting-started': {
    Content: GettingStarted,
    title: gettingStartedTitle,
    lead: gettingStartedLead,
    sections: gettingStartedSections,
  },
  'trace-packages': {
    Content: TracePackages,
    title: tracePackagesTitle,
    lead: tracePackagesLead,
    sections: tracePackageSections,
  },
};
