declare module '*.mdx' {
  import type { MDXContent } from 'mdx/types';

  export type DocSection = {
    heading: string;
    id: string;
    level: 2 | 3;
    text: string;
  };

  export const title: string;
  export const lead: string;
  export const docSections: DocSection[];
  const Content: MDXContent;
  export default Content;
}
